from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0014_rich_text_titles"),
    ]

    operations = [
        migrations.AddField(
            model_name="survey",
            name="language",
            field=models.CharField(
                choices=[("en", "English"), ("am", "Amharic")],
                default="en",
                max_length=2,
            ),
        ),
    ]
