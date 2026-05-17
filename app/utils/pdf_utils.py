"""PDF generation utilities for receipts, statements, and contracts."""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.config import GENERATED_DIR, PROJECT_ROOT
from app.utils.db_utils import fetchone, fetchall, all_settings, format_money, status_title

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
except Exception:
    arabic_reshaper = None
    get_display = None

BASE_DIR = PROJECT_ROOT
GENERATED_DIR.mkdir(exist_ok=True)


def ar_text(text):
    text = str(text if text is not None else "")
    if arabic_reshaper and get_display:
        try:
            return get_display(arabic_reshaper.reshape(text))
        except Exception:
            return text
    return text


def register_arabic_font():
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/tahoma.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for font_path in candidates:
        if font_path.exists():
            try:
                pdfmetrics.registerFont(TTFont("ArabicUI", str(font_path)))
                return "ArabicUI"
            except Exception:
                pass
    return "Helvetica"


PDF_FONT = register_arabic_font()


def draw_rtl_line(c, text, x, y, size=11, bold=False):
    c.setFont(PDF_FONT, size)
    c.drawRightString(x, y, ar_text(text))


def generate_pdf(title, sections, filename, footer):
    path = GENERATED_DIR / filename
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 24 * mm
    c.setFillColor(colors.HexColor("#171512"))
    draw_rtl_line(c, title, width - 20 * mm, y, 18)
    y -= 10 * mm
    c.setStrokeColor(colors.HexColor("#d9b565"))
    c.line(20 * mm, y, width - 20 * mm, y)
    y -= 10 * mm
    for section_title, lines in sections:
        if y < 35 * mm:
            draw_rtl_line(c, footer, width - 20 * mm, 18 * mm, 9)
            c.showPage()
            y = height - 24 * mm
        c.setFillColor(colors.HexColor("#9c6f38"))
        draw_rtl_line(c, section_title, width - 20 * mm, y, 14)
        y -= 8 * mm
        c.setFillColor(colors.HexColor("#171512"))
        for line in lines:
            if y < 25 * mm:
                draw_rtl_line(c, footer, width - 20 * mm, 18 * mm, 9)
                c.showPage()
                y = height - 24 * mm
            draw_rtl_line(c, line, width - 20 * mm, y, 11)
            y -= 7 * mm
        y -= 4 * mm
    c.setFillColor(colors.HexColor("#62584a"))
    draw_rtl_line(c, footer, width - 20 * mm, 18 * mm, 9)
    c.save()
    return path


def generate_contract_pdf(conn, deal, is_draft=True):
    """Generate a contract PDF for a deal. Draft has watermark."""
    apartment = fetchone(conn, "SELECT * FROM apartments WHERE id = %s", (deal["apartment_id"],))
    assistant = fetchone(conn, "SELECT * FROM admins WHERE id = %s", (deal["created_by_user_id"],)) if deal.get("created_by_user_id") else None
    approver = fetchone(conn, "SELECT * FROM admins WHERE id = %s", (deal["approved_by"],)) if deal.get("approved_by") else None
    settings = all_settings(conn)

    contract_num = f"CNT-{deal['deal_number']}"
    label = "مسودة غير نهائية - لا تعتمد إلا بعد موافقة الإدارة" if is_draft else "عقد نهائي معتمد من الإدارة"
    title = "عقد مسودة" if is_draft else "العقد النهائي"

    sections = [
        (label, []),
        ("بيانات العقد", [
            f"رقم العقد: {contract_num}",
            f"رقم الديل: {deal['deal_number']}",
            f"تاريخ العقد: {deal.get('created_at', '')[:10]}",
            f"اسم المكتب: {settings.get('office_name', '')}",
        ]),
        ("بيانات العميل", [
            f"اسم العميل: {deal.get('client_name', '')}",
            f"رقم الهاتف: {deal.get('client_phone', '')}",
            f"الرقم القومي: {deal.get('client_national_id', 'غير متوفر')}",
        ]),
        ("بيانات الوحدة", [
            f"رقم الوحدة: {apartment['unit_code'] if apartment else ''}",
            f"الدور: {apartment['floor_number'] if apartment else ''}",
            f"المساحة: {apartment['area'] if apartment else ''} م²",
            f"الاتجاه: {apartment['direction_ar'] if apartment else ''}",
        ]),
        ("البيانات المالية", [
            f"السعر الإجمالي: {format_money(deal.get('total_amount', 0))}",
            f"المقدم: {format_money(deal.get('down_payment', 0))}",
            f"المتبقي: {format_money(deal.get('remaining_amount', 0))}",
            f"طريقة الدفع: {deal.get('payment_plan_type', '')}",
        ]),
        ("المسؤولون", [
            f"المساعد: {assistant['full_name'] if assistant else 'غير محدد'}",
            f"اعتماد الإدارة: {approver['full_name'] if approver else 'بانتظار الموافقة'}",
        ]),
    ]

    if is_draft:
        sections.append(("تنبيه", ["هذه المسودة غير نهائية ولا تعتمد إلا بعد موافقة الإدارة."]))

    footer = settings.get("statement_footer", "هذا المستند صادر إلكترونيًا من نظام إدارة الحجوزات.")
    filename = f"contract-{'draft' if is_draft else 'final'}-{deal['id']}.pdf"

    path = GENERATED_DIR / filename
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4

    if is_draft:
        c.saveState()
        c.setFillColor(colors.Color(0.85, 0.75, 0.55, alpha=0.15))
        c.setFont(PDF_FONT, 52)
        c.translate(width / 2, height / 2)
        c.rotate(45)
        c.drawCentredString(0, 0, ar_text("مسودة"))
        c.restoreState()

    y = height - 24 * mm
    c.setFillColor(colors.HexColor("#171512"))
    draw_rtl_line(c, title, width - 20 * mm, y, 20)
    y -= 12 * mm
    c.setStrokeColor(colors.HexColor("#d9b565"))
    c.line(20 * mm, y, width - 20 * mm, y)
    y -= 10 * mm

    for section_title, lines in sections:
        if y < 35 * mm:
            c.showPage()
            y = height - 24 * mm
            if is_draft:
                c.saveState()
                c.setFillColor(colors.Color(0.85, 0.75, 0.55, alpha=0.15))
                c.setFont(PDF_FONT, 52)
                c.translate(width / 2, height / 2)
                c.rotate(45)
                c.drawCentredString(0, 0, ar_text("مسودة"))
                c.restoreState()
        c.setFillColor(colors.HexColor("#9c6f38"))
        draw_rtl_line(c, section_title, width - 20 * mm, y, 14)
        y -= 8 * mm
        c.setFillColor(colors.HexColor("#171512"))
        for line in lines:
            if y < 25 * mm:
                c.showPage()
                y = height - 24 * mm
            draw_rtl_line(c, line, width - 20 * mm, y, 11)
            y -= 7 * mm
        y -= 4 * mm

    c.setFillColor(colors.HexColor("#62584a"))
    draw_rtl_line(c, footer, width - 20 * mm, 18 * mm, 9)
    c.save()
    return path


def receipt_sections(conn, payment_id):
    payment = fetchone(conn, "SELECT * FROM payments WHERE id = %s", (payment_id,))
    if not payment:
        raise ValueError("Payment not found")
    client = fetchone(conn, "SELECT * FROM clients WHERE id = %s", (payment["client_id"],))
    apartment = fetchone(conn, "SELECT * FROM apartments WHERE id = %s", (payment.get("apartment_id"),))
    settings = all_settings(conn)
    title = "إيصال دفع"
    lines = [
        f"اسم المكتب: {settings.get('office_name', '')}",
        f"رقم الإيصال: {payment.get('receipt_number', '')}",
        f"تاريخ الدفع: {payment['payment_date']}",
        f"اسم العميل: {client['full_name']}",
        f"كود الحجز: {client['client_code']}",
        f"رقم الوحدة: {apartment['unit_code'] if apartment else ''}",
        f"الدور: {apartment['floor_number'] if apartment else ''}",
        f"المساحة: {apartment['area'] if apartment else ''} م²",
        f"الاتجاه: {apartment['direction_ar'] if apartment else ''}",
        f"المبلغ: {format_money(payment['amount'])}",
        f"طريقة الدفع: {status_title(payment['payment_method'])}",
        f"السعر الإجمالي: {format_money(client['total_amount'])}",
        f"إجمالي المدفوع: {format_money(client['paid_amount'])}",
        f"المتبقي: {format_money(client['remaining_amount'])}",
        f"ملاحظات: {payment.get('notes') or '-'}",
    ]
    return title, [("بيانات الإيصال", lines)], "هذا الإيصال صادر إلكترونيًا من نظام إدارة الحجوزات."


def statement_sections(conn, client_id):
    client = fetchone(conn, "SELECT * FROM clients WHERE id = %s", (client_id,))
    if not client:
        raise ValueError("Client not found")
    apartment = fetchone(conn, "SELECT * FROM apartments WHERE id = %s", (client.get("apartment_id"),)) if client.get("apartment_id") else None
    payments = fetchall(conn, "SELECT * FROM payments WHERE client_id = %s ORDER BY payment_date ASC", (client_id,))
    installments = fetchall(conn, "SELECT * FROM installments WHERE client_id = %s ORDER BY installment_number ASC", (client_id,))
    settings = all_settings(conn)
    sections = [
        ("بيانات العميل", [
            f"اسم العميل: {client['full_name']}",
            f"كود الحجز: {client['client_code']}",
            f"الهاتف: {client.get('phone') or '-'}",
            f"حالة الحجز: {status_title(client['reservation_status'])}",
            f"تاريخ الحجز: {client['reservation_date']}",
            f"تاريخ الاستلام المتوقع: {client.get('expected_delivery_date') or '-'}",
        ]),
        ("تفاصيل الشقة", [
            f"رقم الوحدة: {apartment['unit_code'] if apartment else '-'}",
            f"الدور: {apartment['floor_number'] if apartment else '-'}",
            f"المساحة: {apartment['area'] if apartment else '-'} م²",
            f"الاتجاه: {apartment['direction_ar'] if apartment else '-'}",
            f"حالة الشقة: {status_title(apartment['status']) if apartment else '-'}",
        ]),
        ("ملخص الدفع", [
            f"السعر الإجمالي: {format_money(client['total_amount'])}",
            f"المدفوع: {format_money(client['paid_amount'])}",
            f"المتبقي: {format_money(client['remaining_amount'])}",
            f"حالة الدفع: {status_title(client['payment_status'])}",
        ]),
        ("سجل المدفوعات",
         [f"{p['payment_date']} - {format_money(p['amount'])} - {status_title(p['payment_method'])} - {p.get('receipt_number') or '-'}" for p in payments] or ["لا توجد مدفوعات"]),
        ("جدول الأقساط",
         [f"قسط {i['installment_number']} - {i['due_date']} - {format_money(i['amount'])} - المتبقي {format_money(i['remaining_amount'])} - {i['status']}" for i in installments] or ["لا توجد أقساط"]),
        ("ملاحظات المكتب", [client.get("office_notes") or "-"]),
    ]
    return "كشف الحجز", sections, settings.get("statement_footer", "هذا المستند صادر إلكترونيًا من نظام إدارة الحجوزات.")
