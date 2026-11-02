"""Email delivery service for password resets and notification workflows."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from backend.config import get_settings

logger = logging.getLogger(__name__)


def _send_smtp_sync(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    settings = get_settings()
    if not settings.smtp_host:
        logger.info(
            "[Email] SMTP not configured. Simulated dev email delivery to %s. Subject: %s",
            to_email,
            subject,
        )
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            if settings.smtp_use_tls:
                server.starttls()

        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)

        server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        server.quit()
        logger.info("[Email] Successfully sent email to %s via %s", to_email, settings.smtp_host)
        return True
    except Exception as exc:
        logger.error("[Email] Failed to send email to %s: %s", to_email, exc)
        return False


async def send_password_reset_email(
    to_email: str,
    reset_link: str,
    full_name: str | None = None,
) -> bool:
    """Send password reset link to user. Works in dev (simulated) and prod (real SMTP)."""
    settings = get_settings()
    recipient_name = full_name or "Edu-Mentor AI Learner"
    expire_minutes = settings.password_reset_token_expire_minutes

    subject = "Reset Your Edu-Mentor AI Password"

    text_body = f"""Hello {recipient_name},

We received a request to reset your password for your Edu-Mentor AI account.

Click the link below or copy and paste it into your browser to reset your password:
{reset_link}

This link is valid for {expire_minutes} minutes and can only be used once.

If you did not request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The Edu-Mentor AI Team
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #6d28d9; font-size: 24px; font-weight: 700; margin: 0;">Edu-Mentor AI</h1>
      <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Intelligent Voice & Educational Tutoring</p>
    </div>
    <h2 style="color: #0f172a; font-size: 18px; font-weight: 600; margin-bottom: 16px;">Hello {recipient_name},</h2>
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      We received a request to reset the password for your account. Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin-bottom: 28px;">
      <a href="{reset_link}" style="display: inline-block; background: linear-gradient(to right, #7c3aed, #4f46e5); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);">
        Reset Password
      </a>
    </div>
    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 12px;">
      This link will expire in <strong>{expire_minutes} minutes</strong> and is strictly single-use.
    </p>
    <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; word-break: break-all;">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="{reset_link}" style="color: #7c3aed;">{reset_link}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
      If you did not request this change, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
"""

    return await asyncio.to_thread(_send_smtp_sync, to_email, subject, text_body, html_body)

