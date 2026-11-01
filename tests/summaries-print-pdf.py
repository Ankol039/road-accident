"""Validate/render the offline print captures with the bundled PDF runtime."""
import logging
import re
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageChops, ImageDraw

logging.getLogger('pdfminer').setLevel(logging.ERROR)
root = Path('output/pdf/summaries-print')
scratch = Path('tmp/summaries-print')
margin = 10 * 72 / 25.4
papers = {'a4-landscape': (841.89, 595.28), 'a4-portrait': (595.28, 841.89), 'letter': (612, 792)}
headers = ['Period', 'Total', 'With injuries', 'Fatalities', 'No injuries', 'Unknown', 'Vehicles', 'Resolved', 'Most common type', 'Top municipality']
month = r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+202[456]'
compact = lambda text: re.sub(r'\s+', '', text)
collision = compact('Multi-vehicle collision involving a passenger jeepney and a delivery truck')
town = compact('San Jose del Monte, Doña Remedios Trinidad')

before = Image.open(scratch / 'summaries-screen-baseline.png').convert('RGB')
after = Image.open(scratch / 'summaries-screen-verify.png').convert('RGB')
assert before.size == after.size
assert ImageChops.difference(before, after).getbbox() is None, 'Screen layout changed'
print('PASS: Summaries screen layout is pixel-identical.')

for paper, size in papers.items():
    pdf_file = root / f'{paper}.pdf'
    with pdfplumber.open(pdf_file) as pdf:
        assert len(pdf.pages) > 1, 'Fixture must exercise pagination'
        texts = []
        row_counts = []
        for number, page in enumerate(pdf.pages, 1):
            assert abs(page.width - size[0]) < 1 and abs(page.height - size[1]) < 1, (paper, page.width, page.height)
            text = page.extract_text() or ''
            texts.append(text)
            period = next(word for word in page.extract_words() if word['text'] == 'Period')
            edges = [0, .14, .21, .28, .35, .42, .49, .56, .63, .815, 1]
            width = page.width - 2 * margin
            for column, header in enumerate(headers):
                cell = page.crop((margin + edges[column] * width, period['top'] - 20,
                                  margin + edges[column + 1] * width, period['bottom'] + 1))
                assert compact(header) in compact(cell.extract_text() or ''), (paper, number, header)
            assert not re.search(r'Download CSV|Download PDF|Group by|\bShow\b|Verified accident records only', text)
            for char in page.chars:
                assert char['x0'] >= margin - 1 and char['x1'] <= page.width - margin + 1, (paper, number, 'horizontal clipping', char)
                # Font ascent boxes can extend about 1.5 pt above the first CSS line box.
                assert char['top'] >= margin - 2 and char['bottom'] <= page.height - margin + 2, (paper, number, 'vertical clipping', char)
            columns = []
            for column in [0, 8, 9]:
                cell = page.crop((margin + edges[column] * width, period['bottom'] + 2,
                                  margin + edges[column + 1] * width, page.height - margin))
                columns.append(cell.extract_text() or '')
            count = len(re.findall(month, columns[0]))
            row_counts.append(count)
            assert count == compact(columns[1]).count(collision) == compact(columns[2]).count(town), (paper, number, 'split row')
        assert sum(row_counts) == 24
        first = compact(texts[0])
        for required in ['Summaries and export', 'Grouped by Month', 'Counting: Verified accident records', '2024-12-01 to 2026-11-01', 'Generated Nov 1, 2026, 2:30 PM']:
            assert compact(required) in first, (paper, required)
        assert '2030' not in ''.join(texts)
        assert 'December 2024' in texts[-1]
        assert re.search(r'\nTotal\s+24', texts[-1]), 'Total must share the final period page'
        # The print chart is a complete raster with dark labels and the same orange bars.
        images = pdf.pages[0].images
        assert len(images) == 1
        image = images[0]
        assert image['x0'] >= margin - 2 and image['x1'] <= pdf.pages[0].width - margin + 2
        assert image['bottom'] <= pdf.pages[0].height - margin + 1
    document = pdfium.PdfDocument(pdf_file)
    rendered = []
    for i in range(len(document)):
        image = document[i].render(scale=1.5).to_pil().convert('RGB')
        image.save(root / f'{paper}-page-{i + 1}.png')
        rendered.append(image)
    # Attach one sheet per paper choice, showing every page with its page number.
    thumbnails = []
    for i, image in enumerate(rendered, 1):
        image.thumbnail((1000, 1400))
        card = Image.new('RGB', (image.width + 20, image.height + 48), '#e5e7eb')
        card.paste(image, (10, 38))
        ImageDraw.Draw(card).text((12, 12), f'{paper} - page {i}', fill='#111111')
        thumbnails.append(card)
    sheet = Image.new('RGB', (sum(image.width for image in thumbnails), max(image.height for image in thumbnails)), '#e5e7eb')
    x = 0
    for image in thumbnails:
        sheet.paste(image, (x, 0))
        x += image.width
    sheet.save(root / f'{paper}-all-pages.png')

    baseline = pdfium.PdfDocument(scratch / f'reports-baseline-{paper}.pdf')
    current = pdfium.PdfDocument(scratch / f'reports-verify-{paper}.pdf')
    assert len(baseline) == len(current)
    for i in range(len(baseline)):
        before = baseline[i].render(scale=1).to_pil().convert('RGB')
        after = current[i].render(scale=1).to_pil().convert('RGB')
        assert before.size == after.size and ImageChops.difference(before, after).getbbox() is None, (paper, i, 'Reports changed')
    print(f'PASS: {paper}: all {len(rendered)} summary pages fit, headers repeat, rows remain whole, Total stays with final period; Reports is pixel-identical.')

with pdfplumber.open(scratch / 'zero-margin-experiment.pdf') as pdf:
    positions = [round(min(c['top'] for c in p.chars), 1) for p in pdf.pages]
    assert min(positions[1:]) < margin - 5, 'Recheck zero-margin pagination decision'
    print(f'Zero-margin experiment: first text on each page at {positions} pt; later pages lose top spacing. Kept 10 mm page margins.')
experiment = pdfium.PdfDocument(scratch / 'zero-margin-experiment.pdf')
for i in range(len(experiment)):
    experiment[i].render(scale=1).to_pil().save(scratch / f'zero-margin-page-{i + 1}.png')
