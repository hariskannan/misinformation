"""Add extra demo users, image posts and moderation examples.

Everything is created through the real application services, so every post
gets a genuine ML prediction. Images are generated locally with Pillow (simple
abstract illustrations) so no third-party images need to be redistributed.

Run after the base demo seed:

    python manage.py seed_extra
"""
import random
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from apps.accounts.models import UserProfile
from apps.core.models import AuditLog
from apps.core.utils import log_audit  # noqa: F401  (kept for parity with views)
from apps.moderation.models import ModerationReview
from apps.posts.models import Comment, Like, Notification, Post, UserReport
from apps.posts.services import create_post_with_prediction, notify

DEMO_PASSWORD = 'TruthGuard#2026'

EXTRA_USERS = [
    ('dummy', 'dummy@example.com', 'Dummy Demo', 'Media Studies'),
    ('emma', 'emma@example.com', 'Emma Wilson', 'Public Health'),
    ('frank', 'frank@example.com', 'Frank Osei', 'Transport Planning'),
    ('grace', 'grace@example.com', 'Grace Lee', 'Environmental Science'),
    ('henry', 'henry@example.com', 'Henry Adams', 'Economics'),
    ('isla', 'isla@example.com', 'Isla Novak', 'Digital Communications'),
]

# Titles act as idempotency keys: rerunning the command will not duplicate posts.
IMAGE_POSTS = [
    (
        'emma',
        'Community garden opens this weekend',
        'The city parks department confirmed that the new community garden will '
        'open on Saturday. According to the project team, 120 households have '
        'already registered for allotments and entry to the opening event is free.',
        'science',
        'Community garden',
        'Opening Saturday - all welcome',
        (16, 122, 87),
    ),
    (
        'frank',
        'New cycle lane along the river',
        'The transport authority published the final plan for a protected cycle '
        'lane along the eastern river bank. Officials stated that construction '
        'starts next month and the route will connect the station with the '
        'university campus.',
        'news',
        'River cycle lane',
        'Connecting the station and campus',
        (30, 64, 175),
    ),
    (
        'grace',
        'Library adds free digital skills workshops',
        'The public library announced a series of free digital skills workshops '
        'for adults. A spokesperson said the sessions cover online safety, '
        'spreadsheets and basic programming, and that registration is open now.',
        'science',
        'Digital skills workshops',
        'Free sessions at the public library',
        (124, 58, 237),
    ),
]

TEXT_POSTS = [
    (
        'henry',
        'Doctors are hiding a miracle detox tea',
        "BREAKING: A former official discovered a miracle cure that doctors don't "
        "want you to know about. This secret herbal mixture was banned instantly "
        "after it was exposed - read before it's deleted!",
        'health',
    ),
    (
        'isla',
        'Leaked memo proves 5G causes memory loss',
        "ALERT: Insiders reveal that the official numbers were manipulated and they "
        "are desperate to keep it quiet. The hidden agenda behind 5G networks that "
        "the ministry doesn't want exposed!",
        'technology',
    ),
    (
        'dummy',
        'Secret study proves public water supply is contaminated',
        "SHOCKING: Scientists confirm the public water supply was contaminated on "
        "purpose but the mainstream media refuses to report it. This leaked "
        "document proves that the city council planned it all along!",
        'health',
    ),
    (
        'emma',
        'Government hid the truth about energy prices',
        "EXPOSED: What the ministry of transport really knows about energy prices "
        "and isn't telling you. Top insider confesses: the documents were forged "
        "and the coverup is massive!",
        'politics',
    ),
    (
        'dummy',
        'City opens new public Wi-Fi zones',
        'The city council announced that free public Wi-Fi will be available in '
        'twelve additional locations from next week. According to officials, the '
        'network is funded through the digital inclusion programme.',
        'technology',
    ),
    (
        'frank',
        'Annual report shows improved air quality',
        'The environmental agency published its annual air quality report on '
        'Tuesday. The report states that nitrogen dioxide levels fell by eight '
        'percent compared with the previous year, and the full dataset is '
        'available on the agency website.',
        'science',
    ),
]

IMAGE_TITLES = {row[1] for row in IMAGE_POSTS}
TEXT_TITLES = {row[1] for row in TEXT_POSTS}
ALL_TITLES = IMAGE_TITLES | TEXT_TITLES


def _gradient_image(title, subtitle, accent):
    """Generate a simple, copyright-free illustration for a demo post."""
    width, height = 1200, 675
    top = tuple(max(0, int(channel * 0.18)) for channel in accent)
    bottom = tuple(min(255, int(channel * 0.55 + 25)) for channel in accent)

    image = Image.new('RGB', (width, height), top)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(
            int(top[index] + (bottom[index] - top[index]) * ratio)
            for index in range(3)
        )
        draw.line([(0, y), (width, y)], fill=color)

    # Decorative translucent circles.
    for radius, offset_x, offset_y in [
        (260, 940, 120),
        (150, 1060, 520),
        (90, 140, 560),
    ]:
        draw.ellipse(
            [
                offset_x - radius,
                offset_y - radius,
                offset_x + radius,
                offset_y + radius,
            ],
            fill=tuple(min(255, channel + 38) for channel in bottom),
        )

    def _font(size):
        for candidate in ('arialbd.ttf', 'Arial Bold.ttf', 'DejaVuSans-Bold.ttf'):
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
        try:
            return ImageFont.load_default(size=size)
        except TypeError:
            return ImageFont.load_default()

    title_font = _font(58)
    subtitle_font = _font(30)

    # Wrap the title to fit the image.
    words = title.split()
    lines, current = [], ''
    for word in words:
        trial = f'{current} {word}'.strip()
        if draw.textlength(trial, font=title_font) <= width - 160:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)

    y = 210
    for line in lines[:3]:
        draw.text((80, y), line, font=title_font, fill=(255, 255, 255))
        y += 74

    draw.text((80, y + 24), subtitle, font=subtitle_font, fill=(226, 232, 240))
    draw.text(
        (80, height - 70),
        'TruthGuard demo illustration',
        font=_font(22),
        fill=(203, 213, 225),
    )

    buffer = BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    return buffer.getvalue()


def _get_or_create_users():
    User = get_user_model()
    users = {}
    for username, email, full_name, department in EXTRA_USERS:
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=DEMO_PASSWORD,
                role='user',
                first_name=full_name.split(' ')[0],
            )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.full_name = full_name
        profile.department = department
        profile.save()
        users[username] = user
    return users


def _approve_with_new_risk(post, moderator, risk_level, remarks):
    previous = post.risk_level
    post.status = Post.Status.APPROVED
    post.risk_level = risk_level
    post.save(update_fields=['status', 'risk_level', 'updated_at'])
    ModerationReview.objects.create(
        post=post,
        moderator=moderator,
        action=ModerationReview.Action.APPROVED,
        remarks=remarks,
        previous_risk_level=previous,
        new_risk_level=risk_level,
    )
    notify(
        post.author,
        'Your post was approved',
        f'A moderator reviewed your post and approved it, lowering the risk '
        f'from {previous} to {risk_level}. Remarks: {remarks}',
        notification_type=Notification.Type.MODERATION,
        post=post,
    )
    AuditLog.objects.create(
        actor=moderator,
        action='post_approved',
        target_type='post',
        target_id=str(post.id),
        details={
            'moderator': moderator.username,
            'previous_risk_level': previous,
            'new_risk_level': risk_level,
            'remarks': remarks,
            'seed': 'seed_extra',
        },
    )


def _reject(post, moderator, remarks):
    post.status = Post.Status.REJECTED
    post.save(update_fields=['status', 'updated_at'])
    ModerationReview.objects.create(
        post=post,
        moderator=moderator,
        action=ModerationReview.Action.REJECTED,
        remarks=remarks,
    )
    notify(
        post.author,
        'Your post was rejected',
        f'A moderator reviewed your post and rejected it. Remarks: {remarks}',
        notification_type=Notification.Type.MODERATION,
        post=post,
    )
    AuditLog.objects.create(
        actor=moderator,
        action='post_rejected',
        target_type='post',
        target_id=str(post.id),
        details={'moderator': moderator.username, 'remarks': remarks,
                 'seed': 'seed_extra'},
    )


def _seed():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    users = _get_or_create_users()
    print(f'Extra demo users ready ({len(users)}). Password: {DEMO_PASSWORD}')

    moderator = User.objects.filter(username='moderator').first()
    admin = User.objects.filter(username='admin').first()
    if moderator is None:
        raise SystemExit('Run "python manage.py seed_demo" first (moderator missing).')

    existing = set(Post.objects.filter(title__in=ALL_TITLES).values_list('title', flat=True))
    if existing == ALL_TITLES:
        print('Extra demo posts already present. Nothing to do.')
        return
    if existing:
        print(f'Some extra demo posts already exist ({len(existing)}); '
              'skipping post creation to avoid duplicates.')
        return

    created = {}

    # Image posts (real content -> low risk, publicly visible).
    for username, title, content, category, image_title, subtitle, accent in IMAGE_POSTS:
        image_bytes = _gradient_image(image_title, subtitle, accent)
        image = ContentFile(image_bytes, name=f'demo_{username}_{len(created)}.png')
        post = create_post_with_prediction(
            author=users[username],
            title=title,
            content=content,
            category=category,
            image=image,
        )
        created[title] = post
        print(f'Image post by @{username}: risk={post.risk_level}, status={post.status}')

    # Text posts: four fake-style (high risk) and two real-style (low risk).
    for username, title, content, category in TEXT_POSTS:
        post = create_post_with_prediction(
            author=users[username],
            title=title,
            content=content,
            category=category,
        )
        created[title] = post
        print(f'Text post by @{username}: risk={post.risk_level}, status={post.status}')

    pending = [p for p in created.values() if p.status == Post.Status.PENDING_REVIEW]

    # 1) Approve one high-risk post but lower its risk to low. This demonstrates
    #    the human override while keeping the model prediction intact.
    if len(pending) >= 1:
        _approve_with_new_risk(
            pending[0], moderator, Post.RiskLevel.LOW,
            'Verified the claims against the cited public health report. The '
            'article exaggerates the findings, but the core statement is accurate. '
            'Risk lowered to low and the post is approved.',
        )

    # 2) Reject another high-risk post.
    if len(pending) >= 2:
        _reject(
            pending[1], moderator,
            'Unverified sensational claims about a public infrastructure programme. '
            'No credible source supports the leaked memo. Rejected.',
        )

    # 3) Leave the remaining high-risk posts pending for the moderator queue.
    print(f'{max(0, len(pending) - 2)} high-risk post(s) left pending for review.')

    # Social activity on the public posts.
    published = [
        p for p in created.values()
        if p.status in (Post.Status.PUBLISHED, Post.Status.APPROVED)
    ]
    rng = random.Random(7)
    comment_texts = [
        'Thanks for sharing this - useful to see the official source linked.',
        'Is there a public meeting about this? I would like to attend.',
        'Good to see local services getting some attention.',
        'I checked the report and the numbers match the summary here.',
    ]
    for index, post in enumerate(published):
        candidates = [u for name, u in users.items() if u != post.author]
        for liker in rng.sample(candidates, k=min(3, len(candidates))):
            Like.objects.get_or_create(post=post, user=liker)
        commenter = rng.choice(candidates)
        Comment.objects.create(
            post=post,
            author=commenter,
            content=rng.choice(comment_texts),
        )
        if index == 0 and len(published) >= 2:
            UserReport.objects.create(
                post=post,
                reporter=users['isla'],
                reason='misinformation',
                details='Can a moderator double-check the source quoted here?',
            )

    # Spread the new posts over the last few days so charts look natural.
    now = timezone.now()
    for index, post in enumerate(created.values()):
        Post.objects.filter(pk=post.pk).update(
            created_at=now - timedelta(days=index % 8, hours=(index * 5) % 24),
        )

    print(f'Created {len(created)} extra demo posts.')
    print('Additional demo logins (password: TruthGuard#2026):')
    print('  dummy / emma / frank / grace / henry / isla')


class Command(BaseCommand):
    help = (
        'Seed six extra demo users, three generated image posts and a set of '
        'high-risk posts demonstrating approval with a risk override and '
        'rejection. Safe to run after seed_demo; idempotent.'
    )

    def handle(self, *args, **options):
        _seed()
