from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['full_name', 'department', 'bio']


class UserSerializer(serializers.ModelSerializer):
    """Full representation of the authenticated user."""

    profile = UserProfileSerializer(read_only=True)
    posts_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 'is_active',
            'date_joined', 'profile', 'posts_count',
        ]
        read_only_fields = ['id', 'role', 'is_active', 'date_joined', 'posts_count']

    def get_posts_count(self, obj):
        return obj.posts.count()


class RegisterSerializer(serializers.Serializer):
    """Registration payload with server-side validation."""

    full_name = serializers.CharField(max_length=120)
    username = serializers.CharField(max_length=150, min_length=3)
    email = serializers.EmailField()
    department = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value):
        if not value.replace('_', '').replace('.', '').replace('-', '').isalnum():
            raise serializers.ValidationError(
                'Username may only contain letters, numbers, dots, dashes and underscores.'
            )
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                'An account with this email address already exists.'
            )
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {'password2': 'The two password fields do not match.'}
            )
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('full_name', '').split(' ')[0][:30],
        )
        UserProfile.objects.create(
            user=user,
            full_name=validated_data['full_name'],
            department=validated_data.get('department', ''),
        )
        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text='Username or email address.')
    password = serializers.CharField(write_only=True)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Editable profile fields."""

    full_name = serializers.CharField(source='profile.full_name', max_length=120, required=False)
    department = serializers.CharField(source='profile.department', max_length=120, required=False)
    bio = serializers.CharField(source='profile.bio', max_length=500, required=False)

    class Meta:
        model = User
        fields = ['full_name', 'department', 'bio']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        profile = instance.profile
        for field, value in profile_data.items():
            setattr(profile, field, value)
        profile.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password2 = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Your current password is incorrect.')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError(
                {'new_password2': 'The two password fields do not match.'}
            )
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    """Admin-facing user list representation."""

    profile = UserProfileSerializer(read_only=True)
    posts_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 'is_active',
            'date_joined', 'last_login', 'profile', 'posts_count',
        ]

    def get_posts_count(self, obj):
        return obj.posts.count()


class AdminUserUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_role(self, value):
        request_user = self.context['request'].user
        target = self.context.get('target_user')
        if target and target == request_user and value != User.Role.ADMIN:
            raise serializers.ValidationError('You cannot demote your own account.')
        return value


class AdminPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=8)
    new_password2 = serializers.CharField(min_length=8)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError(
                {'new_password2': 'The two password fields do not match.'}
            )
        return attrs
