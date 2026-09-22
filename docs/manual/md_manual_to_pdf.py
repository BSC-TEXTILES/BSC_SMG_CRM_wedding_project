# -*- coding: utf-8 -*-
"""Render USER_MANUAL.md (with embedded screenshots) into a styled A4 PDF.

Cover page + full markdown body: headings, paragraphs, tables, lists,
code spans and images. Very tall full-page screenshots are sliced into
readable vertical chunks. Output: BSC_User_Manual_Full.pdf (repo root).
"""
import math
import os
import re
import html as htmlmod

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
MD_PATH = os.path.join(ROOT, 'USER_MANUAL.md')
OUT_PATH = os.path.join(ROOT, 'BSC_User_Manual_Full.pdf')
LOGO = os.path.join(ROOT, 'Main_logo.png')
SLICE_DIR = os.path.join(HERE, 'slices')

FONT_DIR = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("TNR", os.path.join(FONT_DIR, "times.ttf")))
pdfmetrics.registerFont(TTFont("TNR-Bold", os.path.join(FONT_DIR, "timesbd.ttf")))
pdfmetrics.registerFont(TTFont("TNR-Italic", os.path.join(FONT_DIR, "timesi.ttf")))
pdfmetrics.registerFont(TTFont("TNR-BoldItalic", os.path.join(FONT_DIR, "timesbi.ttf")))
registerFontFamily("TNR", normal="TNR", bold="TNR-Bold", italic="TNR-Italic", boldItalic="TNR-BoldItalic")

NAVY = colors.HexColor('#101C36')
GOLD = colors.HexColor('#C9A45C')
ACCENT = colors.HexColor('#23748f')
TEXT = colors.HexColor('#171715')
MUTED = colors.HexColor('#6d6a64')
STRIPE = colors.HexColor('#f0efee')
BORDER = colors.HexColor('#d1cab7')

PAGE_W, PAGE_H = A4
MARGIN = 1.9 * cm
AVAIL_W = PAGE_W - 2 * MARGIN
USABLE_H = PAGE_H - (MARGIN + 0.5 * cm) - (MARGIN + 0.4 * cm)  # frame height
SLICE_ASPECT = (USABLE_H - 1.2 * cm) / AVAIL_W                  # slice fills one full page
UPSCALE = 2.0                                                   # 2x LANCZOS + sharpen for print clarity

S = {
    'h1': ParagraphStyle('h1', fontName='TNR-Bold', fontSize=17, leading=21, textColor=NAVY,
                         spaceBefore=16, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='TNR-Bold', fontSize=13, leading=17, textColor=TEXT,
                         spaceBefore=12, spaceAfter=4),
    'h3': ParagraphStyle('h3', fontName='TNR-Bold', fontSize=11, leading=15, textColor=ACCENT,
                         spaceBefore=10, spaceAfter=3),
    'h4': ParagraphStyle('h4', fontName='TNR-Bold', fontSize=10.5, leading=14, textColor=TEXT,
                         spaceBefore=8, spaceAfter=2),
    'body': ParagraphStyle('body', fontName='TNR', fontSize=10, leading=14.5, textColor=TEXT,
                           alignment=TA_JUSTIFY, spaceAfter=6),
    'bullet': ParagraphStyle('bullet', fontName='TNR', fontSize=10, leading=14, textColor=TEXT,
                             leftIndent=14, bulletIndent=3, spaceAfter=2.5),
    'quote': ParagraphStyle('quote', fontName='TNR-Italic', fontSize=9.5, leading=13.5,
                            textColor=MUTED, leftIndent=12, spaceBefore=4, spaceAfter=8),
    'caption': ParagraphStyle('caption', fontName='TNR-Italic', fontSize=8.5, leading=11,
                              textColor=MUTED, alignment=TA_CENTER, spaceBefore=2, spaceAfter=10),
    'th': ParagraphStyle('th', fontName='TNR-Bold', fontSize=8.6, leading=11, textColor=colors.white),
    'td': ParagraphStyle('td', fontName='TNR', fontSize=8.8, leading=11.5, textColor=TEXT),
}


def inline(text):
    """markdown inline -> reportlab mini-XML"""
    t = htmlmod.escape(text, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<i>\1</i>', t)
    t = re.sub(r'`([^`]+)`', r'<font face="Courier" color="#7a4a1f">\1</font>', t)
    t = t.replace('✅', 'YES').replace('✖', 'no').replace('→', '->').replace('←', '<-')
    t = t.replace('§', 'Sec ').replace('×', 'x').replace('—', '-').replace('–', '-')
    t = t.replace('’', "'").replace('“', '"').replace('”', '"').replace('•', '*')
    t = t.replace('💍', '(ring)').replace('📍', '(loc)').replace('📱', '(phone)')
    t = t.replace('👤', '(person)').replace('🚨', '!!').replace('⚠️', '!').replace('⭐', '*')
    t = t.replace('✓', 'v').replace('▲', '^').replace('▼', 'v')
    return t


IMG_RE = re.compile(r'^!\[([^\]]*)\]\(([^)]+)\)\s*$')
TABLE_SEP = re.compile(r'^\s*\|[\s:|-]+\|\s*$')


def _beautify(im, path):
    """2x upscale with LANCZOS + unsharp mask; cache to slices dir."""
    from PIL import ImageFilter
    w, h = im.size
    im = im.convert('RGB').resize((int(w * UPSCALE), int(h * UPSCALE)), PILImage.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=110, threshold=2))
    os.makedirs(SLICE_DIR, exist_ok=True)
    out = os.path.join(SLICE_DIR, os.path.basename(path).replace('.png', '_hd.png'))
    im.save(out, optimize=True)
    return out, im.size


def prep_image(path):
    """Return list of (png_path, w, h) high-definition pieces sized for print."""
    if not os.path.exists(path):
        return []
    im = PILImage.open(path)
    hd_path, (w, h) = _beautify(im, path)
    if h / w <= SLICE_ASPECT * 1.15:
        return [(hd_path, w, h)]
    # slice in UPSCALED pixel space so crops keep the exact aspect ratio
    big = PILImage.open(hd_path)
    bw, bh = big.size
    slice_h = int(bw * SLICE_ASPECT)
    n = max(2, math.ceil(bh / slice_h))
    slice_h = math.ceil(bh / n)
    base = os.path.splitext(os.path.basename(path))[0]
    out = []
    for i in range(n):
        box = (0, min(i * slice_h, bh - 1), bw, min((i + 1) * slice_h, bh))
        crop = big.crop(box)
        sp = os.path.join(SLICE_DIR, f'{base}_hd_p{i+1}.png')
        crop.save(sp, optimize=True)
        out.append((sp, crop.size[0], crop.size[1]))
    return out


def image_flowables(alt, rel):
    path = os.path.normpath(os.path.join(ROOT, rel.replace('/', os.sep)))
    pieces = prep_image(path)
    fl = []
    for (p, w, h) in pieces:
        # full content width first; only shrink if a piece is still too tall
        scale = AVAIL_W / w
        if h * scale > USABLE_H - 1.4 * cm:
            scale = (USABLE_H - 1.4 * cm) / h
        fl.append(PageBreak())
        fl.append(Image(p, width=w * scale, height=h * scale, hAlign='CENTER'))
    if not fl:
        fl.append(Paragraph(f'[missing image: {rel}]', S['quote']))
    return fl


def build_table(rows):
    header, body = rows[0], rows[1:]
    ncols = len(header)
    def cells(r):
        r = list(r) + [''] * (ncols - len(r))
        return r[:ncols]
    data = [[Paragraph(inline(c), S['th']) for c in cells(header)]] + \
           [[Paragraph(inline(c), S['td']) for c in cells(r)] for r in body]
    weights = []
    for j in range(ncols):
        maxlen = max(len(cells(r)[j]) for r in [header] + body) if body else len(header[j])
        weights.append(max(6.0, min(60.0, maxlen ** 1.15)))
    tot = sum(weights)
    col_w = [AVAIL_W * wgt / tot for wgt in weights]
    t = Table(data, colWidths=col_w, repeatRows=1, hAlign='LEFT')
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4.5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4.5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), STRIPE))
    t.setStyle(TableStyle(style))
    return t


def parse(md_text):
    story = []
    lines = md_text.split('\n')
    i = 0
    # skip front matter until first '---' (cover is rendered separately)
    while i < len(lines) and lines[i].strip() != '---':
        i += 1
    i += 1
    while i < len(lines):
        ln = lines[i]
        st = ln.strip()
        if not st:
            i += 1
            continue
        if st == '---':
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width='100%', thickness=0.7, color=BORDER, spaceAfter=8))
            i += 1
            continue
        m = IMG_RE.match(st)
        if m:
            alt, rel = m.group(1), m.group(2)
            cap = None
            if i + 1 < len(lines) and lines[i + 1].strip().startswith('*Figure'):
                cap = lines[i + 1].strip().strip('*')
                i += 2
            else:
                i += 1
            grp = image_flowables(alt, rel)
            if cap and len(grp) > 1:
                grp.insert(2, Paragraph(inline(cap), S['caption']))  # after PageBreak + first image
            elif cap:
                grp.append(Paragraph(inline(cap), S['caption']))
            story.extend(grp)
            continue
        if st.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = lines[i].strip()
                if not TABLE_SEP.match(row):
                    rows.append([c.strip() for c in row.strip('|').split('|')])
                i += 1
            if rows:
                story.append(build_table(rows))
                story.append(Spacer(1, 6))
            continue
        if st.startswith('# '):
            txt = st[2:]
            if txt.upper().startswith('PART'):
                story.append(PageBreak())
                story.append(Paragraph(inline(txt), S['h1']))
                story.append(HRFlowable(width='100%', thickness=1.4, color=GOLD, spaceAfter=10))
            else:
                story.append(Paragraph(inline(txt), S['h1']))
            i += 1
            continue
        if st.startswith('## '):
            story.append(Paragraph(inline(st[3:]), S['h2']))
            story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=4))
            i += 1
            continue
        if st.startswith('### '):
            story.append(Paragraph(inline(st[4:]), S['h3']))
            i += 1
            continue
        if st.startswith('#### '):
            story.append(Paragraph(inline(st[5:]), S['h4']))
            i += 1
            continue
        if st.startswith('> '):
            buf = [st[2:]]
            while i + 1 < len(lines) and lines[i + 1].strip().startswith('> '):
                i += 1
                buf.append(lines[i].strip()[2:])
            story.append(Paragraph(inline(' '.join(buf)), S['quote']))
            i += 1
            continue
        mnum = re.match(r'^(\d+)\.\s+(.*)$', st)
        if st.startswith('- ') or mnum:
            bullet = '* ' if st.startswith('- ') else f'{mnum.group(1)}. '
            text = st[2:] if st.startswith('- ') else mnum.group(2)
            depth = (len(ln) - len(ln.lstrip())) // 2
            style = ParagraphStyle('b2', parent=S['bullet'], leftIndent=14 + depth * 12)
            story.append(Paragraph(inline(text), style, bulletText=bullet.strip()))
            i += 1
            continue
        # plain paragraph (merge soft-wrapped lines)
        buf = [st]
        while i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if (not nxt or nxt.startswith(('#', '|', '- ', '> ', '![')) or nxt == '---'
                    or re.match(r'^\d+\.\s', nxt)):
                break
            buf.append(nxt)
            i += 1
        story.append(Paragraph(inline(' '.join(buf)), S['body']))
        i += 1
    return story


def make_doc():
    doc = BaseDocTemplate(OUT_PATH, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN + 0.5 * cm, bottomMargin=MARGIN + 0.4 * cm,
                          title='BSC EXCLUSIVE - Complete User Manual',
                          author='BSC Textiles',
                          subject='Wedding CRM, Feedback & QR, Store Operations, Talent - Full User Manual')
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='body')
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id='cover', leftPadding=0, rightPadding=0,
                        topPadding=0, bottomPadding=0)

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont('TNR', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, 1.1 * cm, 'BSC EXCLUSIVE - Complete User Manual (v2.0)')
        canvas.drawRightString(PAGE_W - MARGIN, 1.1 * cm, f'Page {canvas.getPageNumber()}')
        canvas.setStrokeColor(BORDER)
        canvas.line(MARGIN, 1.5 * cm, PAGE_W - MARGIN, 1.5 * cm)
        canvas.restoreState()

    doc.addPageTemplates([
        PageTemplate(id='cover', frames=[cover_frame], onPage=draw_cover),
        PageTemplate(id='body', frames=[frame], onPage=footer),
    ])
    return doc


COVER_STATE = {'done': False}


def draw_cover(canvas, _doc):
    if COVER_STATE['done']:
        return
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_H - 1.1 * cm, PAGE_W, 1.1 * cm, fill=1, stroke=0)
    canvas.rect(0, 0, PAGE_W, 1.1 * cm, fill=1, stroke=0)
    try:
        im = PILImage.open(LOGO)
        lw, lh = im.size
        s = min(6.5 * cm / lw, 6.5 * cm / lh)
        canvas.saveState()
        canvas.setFillColor(colors.white)
        canvas.roundRect((PAGE_W - 5.4 * cm) / 2, PAGE_H - 10.6 * cm, 5.4 * cm, 5.4 * cm, 10, fill=1, stroke=0)
        canvas.restoreState()
        canvas.drawImage(LOGO, (PAGE_W - lw * s) / 2, PAGE_H - 10.6 * cm + (5.4 * cm - lh * s) / 2,
                         lw * s, lh * s, mask='auto')
    except Exception:
        pass
    canvas.setFillColor(colors.white)
    canvas.setFont('TNR-Bold', 30)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 14.2 * cm, 'BSC EXCLUSIVE')
    canvas.setFont('TNR', 16)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 15.6 * cm, 'Complete User Manual')
    canvas.setFillColor(GOLD)
    canvas.setFont('TNR-Italic', 11.5)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 17.1 * cm,
                             'Enterprise Operations Portal - Wedding CRM - Feedback & QR - Store Operations - Talent')
    canvas.setFillColor(colors.white)
    canvas.setFont('TNR', 10.5)
    canvas.drawCentredString(PAGE_W / 2, 6.6 * cm, 'Manual version 2.0   -   22 September 2026')
    canvas.drawCentredString(PAGE_W / 2, 5.9 * cm, 'BSC v3.0   -   Belagavi - Davanagere - Shivamogga')
    canvas.setFont('TNR-Italic', 9)
    canvas.setFillColor(colors.HexColor('#b8c0d4'))
    canvas.drawCentredString(PAGE_W / 2, 4.6 * cm,
                             'Prepared from the actual production code, live screens and database structure.')
    canvas.restoreState()
    COVER_STATE['done'] = True


def main():
    md = open(MD_PATH, encoding='utf-8').read()
    story = [NextPageTemplate('body'), PageBreak()] + parse(md)
    doc = make_doc()
    doc.build(story)
    print('PDF OK:', OUT_PATH)
    from pypdf import PdfReader
    print('pages:', len(PdfReader(OUT_PATH).pages))


if __name__ == '__main__':
    main()
