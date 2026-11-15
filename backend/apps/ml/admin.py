from django.contrib import admin

from .models import MLModelVersion, Prediction, TrainingJob


@admin.register(MLModelVersion)
class MLModelVersionAdmin(admin.ModelAdmin):
    list_display = ('name', 'algorithm', 'version_tag', 'status', 'trained_at')
    list_filter = ('algorithm', 'status')
    search_fields = ('name',)
    readonly_fields = [f.name for f in MLModelVersion._meta.fields]


@admin.register(TrainingJob)
class TrainingJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'algorithm', 'status', 'created_at', 'finished_at')
    list_filter = ('algorithm', 'status')
    readonly_fields = [f.name for f in TrainingJob._meta.fields]


@admin.register(Prediction)
class PredictionAdmin(admin.ModelAdmin):
    list_display = ('id', 'predicted_label', 'risk_level', 'confidence',
                    'model_version', 'created_at')
    list_filter = ('predicted_label', 'risk_level')
    search_fields = ('input_text',)
