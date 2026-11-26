"""公式サイトの配信用ディレクトリに確認済みガイドを展開する。"""
import argparse
import hashlib
import io
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

VERSION = "v0.2.7"
SHA256 = "66716afe5b0c628c4467ff7feb772f7d7c32bf505e00909cb963b2e92ddb191d"
URL = f"https://github.com/latent-bridge/okinawa-kaupue-guide-preview/releases/download/{VERSION}/okinawa-guide.zip"


def install(site, local_zip):
    if not (site / "index.html").is_file():
        raise ValueError("公式サイトの配信用ディレクトリを指定してください")
    if local_zip:
        data = local_zip.read_bytes()
    else:
        with urlopen(URL, timeout=60) as response:
            data = response.read()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError("確認済みガイドのSHA-256と一致しません")

    guide = site / "guide"
    guide.mkdir()  # 古い版のファイルが残らないよう、新しい配備物に展開する
    with ZipFile(io.BytesIO(data)) as archive:
        archive.extractall(guide)
    for page in guide.rglob("*.html"):
        html = page.read_text(encoding="utf-8")
        home = "../index.html" if page.parent != guide else "index.html"
        header_link = f'<header><a href="{home}">沖繩交陪</a>'
        if header_link not in html:
            raise ValueError(f"ガイドから公式トップへのリンクを確認してください: {page.name}")
        html = html.replace(header_link, '<header><a href="/">沖繩交陪</a>', 1)
        page.write_text(html.replace("旅行指南・試閱版", "旅行指南"), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    parser.add_argument("--zip", type=Path)
    args = parser.parse_args()
    install(args.site, args.zip)
