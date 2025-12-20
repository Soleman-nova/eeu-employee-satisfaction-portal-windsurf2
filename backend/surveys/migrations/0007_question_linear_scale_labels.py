"""Schema migration.

NOTE: Backfill is handled in the next migration to keep schema/data changes separated.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0006_question_max_chars'),
    ]

    operations = [
        migrations.AddField(
            model_name='question',
            name='linear_scale_labels',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
