import asyncio
import json
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

QUEUE_EMAIL = "gamecover:queue:email"


def _smtp_exception_context(exc: BaseException) -> dict[str, Any]:
    """Extract SMTP response codes and readable text; str(exc) alone is often empty."""
    ctx: dict[str, Any] = {
        "exc_type": type(exc).__name__,
        "message": str(exc) or repr(exc),
    }
    code = getattr(exc, "smtp_code", None)
    if code is not None:
        ctx["smtp_code"] = code
    err = getattr(exc, "smtp_error", None)
    if err is not None:
        if isinstance(err, bytes):
            ctx["smtp_error"] = err.decode(errors="replace")
        else:
            ctx["smtp_error"] = str(err)
    return ctx


class EmailService:
    def __init__(self):
        self.enabled = bool(settings.EMAIL_ENABLED)
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_use_tls = bool(settings.SMTP_USE_TLS)
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
        self.templates_dir = Path(__file__).resolve().parents[1] / "templates" / "emails"

    def is_configured(self) -> bool:
        return bool(
            self.enabled
            and self.smtp_host
            and self.from_email
        )

    def _render_html_template(self, template_name: str, **context: object) -> Optional[str]:
        template_path = self.templates_dir / template_name
        if not template_path.exists():
            logger.warning("Email template not found", template=str(template_path))
            return None
        try:
            template = template_path.read_text(encoding="utf-8")
            return template.format(**context)
        except Exception as e:
            logger.error("Failed to render email template", template=template_name, error=str(e))
            return None

    def _send_sync(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> None:
        if not self.is_configured():
            logger.info("Email sending skipped (not configured)", to_email=to_email, subject=subject)
            return

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = to_email
        msg.set_content(body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20) as server:
            if settings.SMTP_DEBUG:
                server.set_debuglevel(1)
            server.ehlo()
            if self.smtp_use_tls:
                server.starttls()
                server.ehlo()
            if self.smtp_username and self.smtp_password:
                server.login(self.smtp_username, self.smtp_password)
            server.send_message(msg)

    def _enqueue_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> bool:
        """Put a failed email into the Redis retry queue."""
        try:
            from app.services.resilient_queue import ResilientQueueService
            queue = ResilientQueueService()
            queue.enqueue(QUEUE_EMAIL, {
                "to_email": to_email,
                "subject": subject,
                "body": body,
                "html_body": html_body,
                "attempts": 0,
            })
            logger.info(
                "Email queued for retry",
                to_email=to_email,
                subject=subject,
            )
            return True
        except Exception as eq:
            logger.error(
                "Failed to enqueue email for retry",
                to_email=to_email,
                subject=subject,
                error=str(eq),
            )
            return False

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> None:
        logger.info(
            "Sending email",
            status="sending",
            to_email=to_email,
            subject=subject,
        )
        try:
            await asyncio.to_thread(self._send_sync, to_email, subject, body, html_body)
            logger.info(
                "Email delivered successfully",
                status="delivered",
                to_email=to_email,
                subject=subject,
            )
        except Exception as e:
            logger.error(
                "Email send failed",
                status="failed",
                exc_info=True,
                to_email=to_email,
                subject=subject,
                smtp_host=self.smtp_host,
                smtp_port=self.smtp_port,
                smtp_use_tls=self.smtp_use_tls,
                **_smtp_exception_context(e),
            )
            # Queue for retry when SMTP is unavailable
            self._enqueue_email(to_email, subject, body, html_body)

    def send_email_sync(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> bool:
        """Synchronous send used by the retry queue task. Returns True on success."""
        logger.info(
            "Sending email (sync/retry)",
            status="retry_sending",
            to_email=to_email,
            subject=subject,
        )
        try:
            self._send_sync(to_email, subject, body, html_body)
            logger.info(
                "Email delivered successfully (retry)",
                status="retry_delivered",
                to_email=to_email,
                subject=subject,
            )
            return True
        except Exception as e:
            logger.error(
                "Email retry send failed",
                status="retry_failed",
                to_email=to_email,
                subject=subject,
                **_smtp_exception_context(e),
            )
            return False

    async def send_welcome_email(self, to_email: str) -> None:
        subject = "Добро пожаловать в RugPay"
        body = (
            "Вы успешно зарегистрировались в RugPay.\n\n"
            "Теперь вы можете отслеживать заказы в личном кабинете.\n"
            "Спасибо, что выбрали наш сервис."
        )
        html = self._render_html_template(
            "welcome.html",
            title=subject,
            preheader="Регистрация завершена",
            heading="Добро пожаловать в RugPay",
            message="Вы успешно зарегистрировались в RugPay. Теперь вы можете отслеживать заказы в личном кабинете.",
            action_text="Открыть сайт",
            action_url=(settings.FRONTEND_URL or "").rstrip("/") or "https://rugpay.ru",
            footer_note="Спасибо, что выбрали наш сервис.",
        )
        await self.send_email(to_email, subject, body, html)

    async def send_order_created_email(
        self,
        to_email: str,
        order_id: int,
        amount_rub: float,
        final_amount_rub: float,
        payment_url: str,
    ) -> None:
        subject = f"Новый заказ RugPay #{order_id}"
        body = (
            f"Ваш заказ #{order_id} создан.\n\n"
            f"Сумма пополнения: {amount_rub:.2f} RUB\n"
            f"Итого к оплате: {final_amount_rub:.2f} RUB\n\n"
            f"Ссылка на оплату:\n{payment_url}\n\n"
            "После оплаты статус можно отслеживать на странице заказа."
        )
        html = self._render_html_template(
            "order-created.html",
            title=subject,
            preheader=f"Заказ #{order_id} создан",
            heading=f"Заказ #{order_id} создан",
            amount=f"{amount_rub:.2f} RUB",
            total=f"{final_amount_rub:.2f} RUB",
            action_text="Перейти к оплате",
            action_url=payment_url,
            footer_note="После оплаты статус заказа обновится автоматически.",
        )
        await self.send_email(to_email, subject, body, html)

    async def send_order_status_email(
        self,
        to_email: str,
        order_id: int,
        status_text: str,
        details: Optional[str] = None,
    ) -> None:
        subject = f"Статус заказа RugPay #{order_id}: {status_text}"
        body = f"Статус вашего заказа #{order_id}: {status_text}\n"
        if details:
            body += f"\nДетали: {details}\n"
        html = self._render_html_template(
            "order-status.html",
            title=subject,
            preheader=f"Статус заказа: {status_text}",
            heading=f"Заказ #{order_id}",
            status=status_text,
            details=details or "Без дополнительных деталей",
            action_text="Открыть сайт",
            action_url=(settings.FRONTEND_URL or "").rstrip("/") or "https://rugpay.ru",
            footer_note="Если у вас есть вопросы, ответьте на это письмо.",
        )
        await self.send_email(to_email, subject, body, html)

    async def send_password_reset_email(
        self,
        to_email: str,
        reset_url: str,
    ) -> None:
        subject = "Восстановление пароля RugPay"
        body = (
            "Вы запросили восстановление пароля.\n\n"
            f"Перейдите по ссылке, чтобы задать новый пароль:\n{reset_url}\n\n"
            "Если это были не вы, просто проигнорируйте это письмо."
        )
        html = self._render_html_template(
            "password-reset.html",
            title=subject,
            preheader="Запрос на смену пароля",
            heading="Восстановление пароля",
            message="Мы получили запрос на смену пароля. Нажмите кнопку ниже, чтобы задать новый пароль.",
            action_text="Сбросить пароль",
            action_url=reset_url,
            footer_note="Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.",
        )
        await self.send_email(to_email, subject, body, html)
