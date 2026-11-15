from django.contrib import admin

from .models import Dataset, DatasetColumnMapping, DatasetVersion


class DatasetVersionInline(admin.TabularInline):
    model = DatasetVersion
    extra = 0
    readonly_fields = [f.name for f in DatasetVersion._meta.fields]


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ('name', 'uploaded_by', 'created_at')
    inlines = (DatasetVersionInline,)


@admin.register(DatasetColumnMapping)
class DatasetColumnMappingAdmin(admin.ModelAdmin):
    list_display = ('dataset', 'original_label', 'mapped_label')
