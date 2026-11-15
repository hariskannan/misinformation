"""Seed the database with demo users, a clearly-labelled synthetic sample
dataset, real trained models and demo social content.

Everything goes through the real application services:
- the dataset is created and validated exactly like an uploaded dataset;
- models are trained with the real training pipeline and their evaluation
  metrics come from actual training runs;
- posts are published through the real prediction workflow.

The sample dataset is SYNTHETIC: it is generated locally with patterned
text so the pipeline can be demonstrated end-to-end without redistributing
third-party news datasets. It is explicitly labelled as synthetic and is
not presented as real-world news data.
"""
import io
import random
from datetime import timedelta

import pandas as pd
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.models import AuditLog
from apps.datasets.models import Dataset, DatasetVersion
from apps.datasets.services import validate_and_clean
from apps.moderation.models import ModerationReview
from apps.posts.models import Comment, Like, Post, UserReport
from apps.posts.services import create_post_with_prediction

from ...models import MLModelVersion, TrainingJob
from ...training import run_training_job

DEMO_PASSWORD = 'TruthGuard#2026'

FAKE_TEMPLATES = [
    "BREAKING: {subject} discovered a miracle cure that doctors don't want you to know about",
    "SHOCKING: The government is hiding the truth about {topic} and silencing {group}",
    "You won't BELIEVE what {person} said about {topic} - this changes everything",
    "Doctors HATE this one weird trick that {benefit} overnight",
    "URGENT: Scientists confirm {claim} but the mainstream media refuses to report it",
    "This secret {thing} was banned instantly after it was exposed - read before it's deleted",
    "ALERT: {org} just admitted the shocking truth about {topic} in a leaked memo",
    "Insiders reveal that {claim} and they are desperate to keep it quiet",
    "They don't want you to know: {thing} is the real cause of {problem}",
    "MIRACLE: Thousands cured overnight using this forbidden {thing}",
    "The hidden agenda behind {topic} that {org} doesn't want exposed",
    "WARNING: Stop using {thing} immediately - it causes {problem} according to secret studies",
    "EXPOSED: What {org} really knows about {topic} and isn't telling you",
    "Top insider confesses: {claim} and the coverup is massive",
    "This leaked document proves that {org} planned {topic} all along",
    "Cure for {problem} found in this cheap {thing} - banned by big pharma",
    "Everyone is talking about the shocking revelation that {claim}",
    "New whistleblowers confirm: {org} knew about {topic} and lied to us",
    "Never before seen footage reveals the truth about {topic}",
    "The real reason {org} banned this {thing} will leave you speechless",
]

REAL_TEMPLATES = [
    "The {org} published a report on {topic} on Tuesday stating that {finding}",
    "According to officials from the {org}, {finding} and the full dataset is available on their website",
    "A spokesperson for the {org} confirmed that {finding} during a press conference",
    "Researchers at the university analyzed {n} studies and concluded that {finding}",
    "The {org} announced on Friday that {finding}, following a review of internal procedures",
    "Government statistics for {topic} show that {finding} compared with the previous quarter",
    "In an interview, {person} explained that {finding} and encouraged readers to consult official sources",
    "The annual survey conducted by the {org} indicates that {finding} among respondents",
    "A peer-reviewed study published this month reports that {finding} with a confidence interval of 95 percent",
    "Local authorities stated that {finding} and that updates will be provided next week",
    "The committee overseeing {topic} voted to approve new measures after {finding}",
    "Financial filings from the {org} show that {finding} in the last fiscal year",
    "Speaking at a public hearing, {person} said that {finding}",
    "The {org} clarified its position on {topic}, noting that {finding}",
    "Hospital records reviewed by journalists indicate that {finding}",
    "A follow-up investigation by the {org} found that {finding}",
    "The quarterly bulletin from the {org} reports that {finding}",
    "Representatives of the {org} met on Monday to discuss {topic} and stated that {finding}",
    "Independent auditors confirmed that {finding} in their final report",
    "The regional office announced that {finding} as part of the ongoing {topic} program",
]

SUBJECTS = ['a researcher', 'a former official', 'an anonymous doctor', 'a viral blog',
            'a self-proclaimed expert', 'a conspiracy channel']
TOPICS = ['the new health guidelines', 'climate policy', 'the vaccination program',
          'the economy', '5G networks', 'public water supply', 'the education reform',
          'energy prices', 'immigration policy', 'food safety standards']
GROUPS = ['journalists', 'scientists', 'critics', 'whistleblowers', 'citizens']
PEOPLE = ['a senior minister', 'the city mayor', 'a leading professor', 'the CEO',
          'a retired judge', 'the department head']
BENEFITS = ['burns fat', 'cures headaches', 'restores eyesight', 'removes toxins',
            'boosts memory']
CLAIMS = ['the official numbers were manipulated', 'the documents were forged',
          'public funds were misused', 'the timeline was altered',
          'the risks were known for years']
THINGS = ['herbal mixture', 'ancient remedy', 'household product', 'detox tea',
          'secret formula']
PROBLEMS = ['chronic fatigue', 'memory loss', 'hair loss', 'digestive problems',
            'sleep disorders']
ORGS = ['city council', 'health department', 'ministry of transport', 'national bank',
        'environmental agency', 'statistics office']
FINDINGS = ['the project remains within budget', 'no irregularities were found',
            'participation increased by eight percent', 'the policy will be reviewed next year',
            'the earlier estimates remain unchanged', 'a public consultation will begin in March']


def _fill(template, rng):
    return template.format(
        subject=rng.choice(SUBJECTS), topic=rng.choice(TOPICS), group=rng.choice(GROUPS),
        person=rng.choice(PEOPLE), benefit=rng.choice(BENEFITS), claim=rng.choice(CLAIMS),
        thing=rng.choice(THINGS), problem=rng.choice(PROBLEMS), org=rng.choice(ORGS),
        finding=rng.choice(FINDINGS), n=rng.choice([12, 26, 40, 58, 73, 120]),
    )


def build_sample_frame(records_per_class=700):
    """Generate a synthetic sample dataset (fake-style vs real-style text)."""
    rng = random.Random(42)
    rows = []
    for _ in range(records_per_class):
        rows.append({'text': _fill(rng.choice(FAKE_TEMPLATES), rng), 'label': 'fake'})
    for _ in range(records_per_class):
        rows.append({'text': _fill(rng.choice(REAL_TEMPLATES), rng), 'label': 'real'})
    rng.shuffle(rows)
    return pd.DataFrame(rows)


def _get_or_create_user(username, email, role, full_name, department='', superuser=False):
    from django.contrib.auth import get_user_model
    from apps.accounts.models import UserProfile
    User = get_user_model()
    user = User.objects.filter(username=username).first()
    if user is None:
        user = User.objects.create_user(
            username=username, email=email, password=DEMO_PASSWORD, role=role,
            first_name=full_name.split(' ')[0],
        )
    if superuser and not (user.is_superuser and user.is_staff):
        user.is_superuser = True
        user.is_staff = True
        user.save()
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.full_name = full_name
    profile.department = department
    profile.save()
    return user, True


def _seed():
    from django.contrib.auth import get_user_model
    User = get_user_model()

    created = []

    admin, _ = _get_or_create_user('admin', 'admin@truthguard.local', 'admin',
                                    'System Administrator', 'Platform Administration',
                                    superuser=True)
    moderator, _ = _get_or_create_user('moderator', 'moderator@truthguard.local',
                                        'moderator', 'Maya Chen', 'Trust & Safety')
    alice, _ = _get_or_create_user('alice', 'alice@example.com', 'user',
                                    'Alice Johnson', 'Computer Science')
    bob, _ = _get_or_create_user('bob', 'bob@example.com', 'user',
                                 'Bob Smith', 'Data Analytics')
    carol, _ = _get_or_create_user('carol', 'carol@example.com', 'user',
                                   'Carol Diaz', 'Journalism')
    dave, _ = _get_or_create_user('dave', 'dave@example.com', 'user',
                                  'Dave Miller', 'Information Systems')
    print('Demo users ready (password for all demo accounts: '
          f'{DEMO_PASSWORD})')

    # ------------------------------------------------------------------
    # Dataset: synthetic sample, created through the real ingestion path.
    # ------------------------------------------------------------------
    dataset = Dataset.objects.filter(
        name='Synthetic Sample Dataset'
    ).first()
    if dataset is None:
        frame = build_sample_frame()
        dataset = Dataset.objects.create(
            name='Synthetic Sample Dataset',
            description=(
                'SYNTHETIC SAMPLE DATASET - generated locally by the seed command '
                'using patterned template text. It exists only to demonstrate and '
                'test the dataset management, training and prediction pipeline '
                'end-to-end. It is NOT a real-world news dataset and results '
                'obtained on it must not be interpreted as real-world performance. '
                'For real evaluation, upload ISOT, LIAR or FakeNewsNet and follow '
                'the documented label mapping.'
            ),
            source_url='',
            license_notes=(
                'Generated for demonstration purposes only. No third-party data '
                'is redistributed.'
            ),
            uploaded_by=admin,
        )
        version = DatasetVersion(
            dataset=dataset,
            version_number=1,
            original_filename='synthetic_sample.csv',
            file_format='csv',
            created_by=admin,
            notes='Synthetic sample generated by the seed command.',
        )
        buffer = io.StringIO()
        frame.to_csv(buffer, index=False)
        version.file.save(
            'synthetic_sample.csv',
            ContentFile(buffer.getvalue().encode('utf-8')),
            save=True,
        )
        version.row_count = len(frame)
        version.column_count = 2
        version.save()
        stats = validate_and_clean(
            version, 'text', 'label', {'fake': 'fake', 'real': 'real'}
        )
        print(f"Dataset validated: {stats['rows_after']} usable records "
              f"({stats['class_distribution']})")
    else:
        version = dataset.versions.order_by('-version_number').first()
        print('Sample dataset already present.')

    # ------------------------------------------------------------------
    # Train all four algorithms and activate the best model (by F1).
    # ------------------------------------------------------------------
    if not MLModelVersion.objects.exists():
        for algorithm in ['decision_tree', 'random_forest', 'naive_bayes', 'svm']:
            job = TrainingJob.objects.create(
                algorithm=algorithm, dataset_version=version, params={},
                created_by=admin,
            )
            AuditLog.objects.create(
                actor=admin, action='model_training_started',
                target_type='training_job', target_id=str(job.id),
                details={'algorithm': algorithm, 'seed': True},
            )
            run_training_job(job.pk)
            job.refresh_from_db()
            if job.status == 'completed':
                model = job.model_version
                print(f'Trained {algorithm}: accuracy={model.metrics.get("accuracy")} '
                      f'f1={model.metrics.get("f1")}')
            else:
                print(f'Training {algorithm} FAILED: {job.error_message}')

        best = max(
            MLModelVersion.objects.all(),
            key=lambda m: (m.metrics or {}).get('f1', 0),
        )
        MLModelVersion.objects.filter(status='active').update(status='deprecated')
        best.status = MLModelVersion.Status.ACTIVE
        best.activated_by = admin
        best.activated_at = timezone.now()
        best.save()
        AuditLog.objects.create(
            actor=admin, action='model_activated', target_type='ml_model',
            target_id=str(best.id),
            details={'name': best.name, 'seed': True},
        )
        print(f'Activated best model: {best.name} (f1={best.metrics.get("f1")})')
    else:
        print('Trained models already present.')

    if not MLModelVersion.objects.filter(status='active').exists():
        best = max(
            MLModelVersion.objects.all(),
            key=lambda m: (m.metrics or {}).get('f1', 0),
        )
        best.status = MLModelVersion.Status.ACTIVE
        best.activated_by = admin
        best.activated_at = timezone.now()
        best.save()
        print(f'Activated best model: {best.name}')

    # ------------------------------------------------------------------
    # Demo social content, created through the real prediction workflow.
    # ------------------------------------------------------------------
    if Post.objects.count() == 0:
        posts_spec = [
            (alice, 'Community science fair opens next week',
             'The city council announced that the annual community science fair '
             'will open next Tuesday at the central exhibition hall. According to '
             'officials, 40 local schools are participating and entry is free.',
             'science', 'real'),
            (bob, 'New public transport schedule',
             'The ministry of transport published the updated bus schedule for the '
             'northern district. Representatives stated that the changes follow a '
             'review of passenger data from the last quarter.',
             'news', 'real'),
            (carol, 'SHOCKING miracle cure story',
             "BREAKING: A researcher discovered a miracle cure that doctors don't "
             "want you to know about. This secret herbal mixture was banned "
             "instantly after it was exposed - read before it's deleted!",
             'health', 'fake'),
            (dave, 'Local library extends opening hours',
             'The city council confirmed that the public library will extend its '
             'opening hours on weekends starting next month. A spokesperson said '
             'the decision follows a public consultation with residents.',
             'news', 'real'),
            (alice, 'Hidden truth about energy prices',
             "ALERT: Insiders reveal that the official numbers were manipulated "
             "and they are desperate to keep it quiet. The hidden agenda behind "
             "energy prices that the ministry doesn't want exposed!",
             'politics', 'fake'),
            (bob, 'University publishes study results',
             'Researchers at the university analyzed 58 studies and concluded '
             'that the earlier estimates remain unchanged. The peer-reviewed '
             'study is available through the university library.',
             'science', 'real'),
        ]
        posts = []
        for author, title, content, category, kind in posts_spec:
            post = create_post_with_prediction(author, title, content, category)
            posts.append(post)
            print(f'Post by @{author.username} -> risk={post.risk_level}, '
                  f'status={post.status}')

        published = [p for p in posts if p.status in ('published', 'approved')]
        pending = [p for p in posts if p.status == 'pending_review']

        # Social interactions
        if len(published) >= 3:
            Like.objects.create(post=published[0], user=bob)
            Like.objects.create(post=published[0], user=carol)
            Like.objects.create(post=published[1], user=alice)
            Like.objects.create(post=published[2], user=alice)
            Comment.objects.create(
                post=published[0], author=bob,
                content='Great to see the community involved - will the fair '
                        'include the robotics demos again this year?',
            )
            Comment.objects.create(
                post=published[0], author=carol,
                content='Thanks for sharing, I will bring my younger sister.',
            )
            Comment.objects.create(
                post=published[2], author=dave,
                content='Good news for students preparing for exams.',
            )

        # A user report on a published post (kept open for the moderator UI)
        if len(published) >= 4:
            UserReport.objects.create(
                post=published[3], reporter=alice, reason='misinformation',
                details='The numbers in this post look suspicious to me, '
                        'can someone verify them?',
            )

        # Moderation history: the moderator decides on two pending posts.
        if len(pending) >= 2:
            ModerationReview.objects.create(
                post=pending[0], moderator=moderator, action='approved',
                remarks='Checked the referenced sources; the claims are '
                        'presented responsibly. Approved.',
            )
            pending[0].status = Post.Status.APPROVED
            pending[0].save(update_fields=['status'])

            ModerationReview.objects.create(
                post=pending[1], moderator=moderator, action='rejected',
                remarks='Unverified sensational claims about public health. '
                        'Rejected pending reliable sources.',
            )
            pending[1].status = Post.Status.REJECTED
            pending[1].save(update_fields=['status'])

        # Spread post creation over the last weeks for realistic activity charts
        now = timezone.now()
        for index, post in enumerate(Post.objects.all().order_by('id')):
            Post.objects.filter(pk=post.pk).update(
                created_at=now - timedelta(days=25 - index * 4,
                                           hours=index * 7 % 24),
            )
        print(f'Created {len(posts)} demo posts with real predictions.')

    print('\nSeed complete.')
    print('Demo accounts (password: TruthGuard#2026):')
    print('  admin     - administrator')
    print('  moderator - moderator')
    print('  alice / bob / carol / dave - normal users')


class Command(BaseCommand):
    help = (
        'Seed demo users, a clearly-labelled synthetic sample dataset, real '
        'trained models (all four algorithms, best activated by F1) and demo '
        'social content created through the real prediction workflow.'
    )

    def handle(self, *args, **options):
        _seed()
