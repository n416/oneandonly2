export interface TutorialSubStep {
  message: string;
  highlightSelector?: string;
  removeOkButton?: boolean;
  waitForClickOn?: string;
  complete?: boolean;
}

export interface TutorialStep {
  match: string; // React Routerのパス (例: "/", "/scenario")
  message: string;
  subSteps: TutorialSubStep[];
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  groupId: string;
  steps: TutorialStep[];
}

export const tutorialGroups = [
  { id: 'basic', name: '基本編' },
  { id: 'advanced', name: '応用編' },
];

export const tutorials: Tutorial[] = [
  {
    id: 'apiKeySetup',
    title: '各種APIキーを設定しよう',
    description: 'Gemini APIキーとStability AI APIキーの入手と設定手順を解説します。',
    groupId: 'basic',
    steps: [
      {
        match: '/',
        message: 'テキスト生成と画像生成に必要なAPIキーの設定を行いましょう。',
        subSteps: [
          {
            message: 'まずは「APIキー設定」ボタンを押してください。',
            highlightSelector: '[data-tutorial="target-apisections"]',
            removeOkButton: true,
            waitForClickOn: '[data-tutorial="target-apisections"]',
          }
        ],
      },
      {
        match: '/settings',
        message: '設定画面です。',
        subSteps: [
          {
            message: 'Gemini APIキーとStability AI APIキーを入力してください。',
          },
          {
            message: '設定できたらホームへ戻ります。',
            highlightSelector: 'a[href="/"]',
            removeOkButton: true,
            waitForClickOn: 'a[href="/"]',
          }
        ]
      }
    ],
  },
  {
    id: 'story1',
    title: 'メインページのボタン説明',
    description: 'ダッシュボードにあるボタンの使い方を順番に説明します。',
    groupId: 'basic',
    steps: [
      {
        match: '/',
        message: 'ダッシュボードの機能説明開始',
        subSteps: [
          {
            message: '生成ボタン: キャラクター作成画面へ移動します。',
            highlightSelector: '[data-tutorial="target-generate"]',
          },
          {
            message: 'パーティボタン: 作成したキャラを編成・管理します。',
            highlightSelector: '[data-tutorial="target-party"]',
          },
          {
            message: '倉庫: 作成したデータが収納されています。',
            highlightSelector: '[data-tutorial="target-warehouse"]',
          },
          {
            message: '以上で、ボタン説明を終わります。',
            complete: true,
          },
        ],
      },
    ],
  },
  {
    id: 'createAvatar',
    title: 'あなたの分身を作成しよう',
    description: '自分だけのアバターを作成するチュートリアルです。',
    groupId: 'basic',
    steps: [
      {
        match: '/',
        message: '「あなたの分身」機能の使い方を学びましょう。',
        subSteps: [
          {
            message: 'まずは「あなたの分身」ボタンを押してください。',
            highlightSelector: '[data-tutorial="target-avatar"]',
            removeOkButton: true,
            waitForClickOn: '[data-tutorial="target-avatar"]',
          }
        ],
      },
      {
        match: '/avatar',
        message: '入力画面が開きました。',
        subSteps: [
          {
            message: '名前や設定を入力し、画像生成ボタンを押してアバターを作成しましょう。',
          },
          {
            message: '保存ボタンを押せば完了です。',
            complete: true,
          }
        ]
      }
    ]
  },
  {
    id: 'story3',
    title: '高度な倉庫管理',
    description: '倉庫画面でのソートやフィルタリング、選択モードなど高度な機能を紹介します。',
    groupId: 'advanced',
    steps: [
      {
        match: '/',
        message: '倉庫管理の使い方を説明します。',
        subSteps: [
          {
            message: 'まずは「倉庫」ボタンを押して、倉庫画面を開きましょう。',
            highlightSelector: '[data-tutorial="target-warehouse"]',
            removeOkButton: true,
            waitForClickOn: '[data-tutorial="target-warehouse"]',
          }
        ]
      },
      {
        match: '/warehouse',
        message: 'これが倉庫画面です。',
        subSteps: [
          {
            message: '画面上のタブをクリックすると、種類ごとにエレメントを絞り込めます。',
          },
          {
            message: 'ソート用のドロップダウンから、名前順や日時順などの並び替えができます。',
          },
          {
            message: '複数のエレメントを一括操作したい場合は「選択モード」を使いましょう。まとめて削除などが可能です。',
          },
          {
            message: '最後に、左上の「戻る」ボタンを押してメニューに戻りましょう。',
            highlightSelector: 'button[title="ホームに戻る"]',
            removeOkButton: true,
            waitForClickOn: 'button[title="ホームに戻る"]',
          },
          {
            message: '以上で、倉庫画面の高度な管理機能の説明は終わりです。',
            complete: true,
          }
        ]
      }
    ]
  }
];
