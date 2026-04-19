# OneAndOnly2

このプロジェクトは、**Tauri + React + TypeScript** によるフロントエンド・デスクトップ基盤と、**Python (FastAPI + llama-cpp/transformers)** によるローカルLLMサーバー（サイドカー）を組み合わせたアプリケーションです。

## プロジェクト構成

- `/src` - React（フロントエンド）のソースコード
- `/src-tauri` - Tauri（Rustバックエンド）のソースコードと設定
- `/llm-api` - PythonベースのローカルLLM APIサーバー（Git Submodule）
- `/scripts` - パッケージング等の自動化スクリプト

---

## 開発・デバッグ (Development & Debugging)

開発中は、**プロジェクトルート（一番上の階層）** から一切移動せずにすべてのコマンドを実行できます。
以下の2つのターミナルを開いて開発を進めるのが基本スタイルです。

### 1. Python APIサーバーの起動（手動デバッグモード）
```powershell
npm run api:dev
```
裏側で自動的に `llm-api` ディレクトリへ移動し、`python main.py` を実行します。
AIモデルの読み込み状況やAPIリクエストのログが画面に直接表示されるため、Python側のデバッグはこちらを見ながら行います。

### 2. Tauri（フロントエンド）の起動
別のターミナルを開き、同じくプロジェクトルートで以下を実行します。
```powershell
npm run tauri dev
```
Tauriのウィンドウが立ち上がり、Reactのホットリロードが有効な状態で開発が可能です。
（※起動時にサイドカーのexeが見つからない場合は自動的に手動デバッグモードと見なされ、上記1で立ち上げたサーバーと通信します）

---

## Python API (llm-api) のビルド手順

Tauriの実行ファイル（exe）からPythonサーバーを自動起動させるため、あらかじめPython側を単体実行可能な `.exe` にコンパイルしておく必要があります。

```powershell
cd llm-api
pip install pyinstaller
pyinstaller --onefile main.py
```

> **Note**: ビルドによって生成された `dist/main.exe` は、手動で移動する必要はありません。後述のパッケージ化スクリプトが自動的に適切な場所へコピー・リネームして組み込みます。

---

## 配布用パッケージの自動構築 (Packaging)

アプリを他のユーザーに配布したり、完成品としてスタンドアロン実行するための最終構成（exe本体 ＋ 設定ファイル ＋ モデルファイル）を自動生成します。

```powershell
npm run package
```

### スクリプトの自動処理内容
1. `llm-api/dist/main.exe` を Tauriのサイドカー用ディレクトリ（`src-tauri/bin/`）にコピー・リネーム。
2. Tauri アプリケーション全体のリリースビルドを実行。
3. プロジェクト直下に `dist_package/` フォルダを作成し、以下の配布構成に集約。

### 最終的な配布用フォルダ構成 (`dist_package`)
```text
dist_package/
 ├── tauri-app.exe   (← ユーザーが実行するアプリ本体)
 ├── .env            (← LLMのモデルパスなどの設定)
 └── models/         (← GGUFなどの重いモデルファイルを置くフォルダ)
```
この構成により、ユーザーはPython環境をインストールすることなく、`.exe` を起動するだけで裏側でローカルLLMサーバーが立ち上がり、すぐにチャットを利用できます。また、モデルデータの差し替えも容易です。
