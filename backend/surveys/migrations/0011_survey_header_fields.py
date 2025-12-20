from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0010_backfill_rating_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="survey",
            name="header_title",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="survey",
            name="header_subtitle",
            field=models.TextField(blank=True, default=""),
        ),
    ]
