import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { editionSchema, normalizeUrl } from '../src/lib/schema';

describe('normalizeUrl', () => {
  it('tracking parameters and fragments are removed', () => {
    expect(normalizeUrl('HTTPS://Example.COM/a/?utm_source=x&b=2#part')).toBe('https://example.com/a?b=2');
  });
});

describe('editorial compliance', () => {
  const edition = JSON.parse(readFileSync('data/daily/2026-10-24.json', 'utf8'));

  it('accepts the reviewed sample edition', () => {
    expect(editionSchema.safeParse(edition).success).toBe(true);
  });

  it('rejects a token explanation', () => {
    const invalid = structuredClone(edition);
    invalid.articles[0].comment = '短い感想です。';
    expect(editionSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects an anticipated-question answer that ends with generic judgment advice', () => {
    const current = JSON.parse(readFileSync('data/daily/2026-10-26.json', 'utf8'));
    const invalid = structuredClone(current);
    const article = invalid.articles.find((item: { narration?: unknown }) => item.narration);
    article.narration.anticipatedQuestions[0].answer =
      '影響する要素は一つではありません。複数の要素を合わせて判断する必要があります。';
    expect(editionSchema.safeParse(invalid).success).toBe(false);
  });

  it('requires substantive structured content for policy version 2', () => {
    const invalid = structuredClone(edition);
    invalid.contentCompliance.policyVersion = 2;
    expect(editionSchema.safeParse(invalid).success).toBe(false);

    const valid = structuredClone(edition);
    valid.contentCompliance.policyVersion = 2;
    for (const article of valid.articles) {
      article.summary = [
        '結論として、この記事では具体的な出来事と、その結果として何が変わるのかを最初に示します。読者が経緯だけを読まされず、ニュースの要点をこの段落で把握できる構成にします。',
        '確認できた主要事実として、主体、対象、数値、時期、比較対象を区別して説明します。情報源自身の評価と、外部資料で照合できた事実を混同せず、判断の根拠を具体的に示します。',
        '適用範囲と限界として、まだ確定していない点、対象外となる人や条件、今後変わり得る部分を説明します。単なる注意書きではなく、どの資料や指標を次に確認すべきかにつなげます。',
      ];
      article.comment = 'この出来事を理解するには、発表内容だけでなく、その前提となる仕組みと比較対象を押さえる必要があります。ここでは専門用語を平易に定義し、実際の利用場面では何が変わるのかを具体例で説明します。さらに、情報源が示した見解、独立して確認できた事実、編集上の推論を分けます。読者への影響は一律ではないため、対象となる条件と対象外の条件を切り分け、判断に使える基準を示します。短期的な変化と中長期的な影響も同一視せず、変化が現れる順序と観測に使える指標を整理します。反対の結果が出る可能性や、比較対象によって評価が変わる条件も説明します。最後に、未確定点を解消するために次回確認すべき文書、数値、当事者の更新を具体化します。概要と同じ結論を繰り返すのではなく、背景から実際の判断へ進める解説です。';
      article.articleDetail = {
        conclusion: '確認済みの事実から導ける結論と、その結論が及ぶ範囲をここで明確にします。断定できない部分も同時に切り分けます。',
        facts: [
          '情報源が公開した日時、対象、数値、実施内容を具体的に整理し、主張と確認済み事実を分けて記録します。確認方法と根拠資料も示します。',
          '比較対象や変更前の状態を示し、何が新しく、何が従来どおりなのかを読者が判断できる形にします。対象外となる条件も補足します。',
        ],
        background: ['この出来事に至った背景と、前提となる制度や仕組みを専門外の読者にも分かる順序で説明します。過去の状態と今回の変化も比較します。'],
        explanation: ['専門用語を定義し、具体例または比較を使って仕組みを説明します。そのうえで、なぜ結果につながるのか、どこに限界があるのか、読者が何を基準に判断できるのかまで段階的に示します。'],
        implications: ['読者の生活、仕事、判断にどう関係するかを、影響を受ける条件と受けない条件に分けて説明します。短期と中長期の違いも示します。'],
        caveats: ['情報源の見解と事実を区別し、現時点では確定していない範囲と誤読しやすい点を具体的に示します。反証になり得る条件も記します。'],
        nextChecks: ['次回の公式更新で対象範囲、確定数値、実施日がどう示されるかを確認し、今回の結論を更新します。'],
      };
    }
    expect(editionSchema.safeParse(valid).success).toBe(true);
  });

  it('does not allow future editions to fall back to policy version 1', () => {
    const future = structuredClone(edition);
    future.date = '2026-10-26';
    for (const article of future.articles) article.editionDate = '2026-10-26';
    expect(editionSchema.safeParse(future).success).toBe(false);
  });

  it('rejects boilerplate padding in policy version 2', () => {
    const invalid = structuredClone(edition);
    invalid.contentCompliance.policyVersion = 2;
    invalid.articles[0].summary = [
      '結論を十分な長さで説明するための文章です。何が起きたのか、誰が関係するのか、その結果は何かを具体的に示して読者が最初に理解できるようにします。',
      '主要な事実を十分な長さで説明する文章です。対象、時期、比較対象、数値など、結論の根拠になる情報を区別して詳しく示します。',
      '適用範囲を十分な長さで説明する文章です。原文の更新、反対意見、対象範囲を継続して確認し、どの条件で結果が変わるかを示します。',
    ];
    invalid.articles[0].comment = '十分な長さの解説です。'.repeat(30);
    invalid.articles[0].articleDetail = {
      conclusion: '確認できた結論を十分な長さで具体的に示し、対象となる範囲も明確に説明します。',
      facts: ['確認できた主要事実を十分な長さで具体的に説明し、情報源の主張とは区別して整理します。', 'もう一つの事実を十分な長さで示し、比較対象と時期を具体的に説明して根拠を明確にします。'],
      background: ['背景となる制度や経緯を十分な長さで説明し、初めて読む人にも前提が伝わるようにします。'],
      explanation: ['仕組みを十分な長さで説明し、用語の定義、具体例、比較、重要性、判断軸まで順番に示します。'],
      implications: ['読者への影響を十分な長さで説明し、対象になる条件と対象外の条件を分けて示します。'],
      caveats: ['未確定点と注意点を十分な長さで説明し、誤解しやすい範囲を具体的に示します。'],
      nextChecks: ['次の公式文書で対象、日付、数値が確定するかを具体的に確認します。'],
    };
    expect(editionSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects unattributed quotation and unlicensed media', () => {
    const invalidQuote = structuredClone(edition);
    invalidQuote.articles[0].editorialReview.quotation = { used: true, text: '引用' };
    expect(editionSchema.safeParse(invalidQuote).success).toBe(false);

    const invalidMedia = structuredClone(edition);
    invalidMedia.articles[0].editorialReview.mediaAssets = [{ url: 'https://example.com/image.jpg' }];
    expect(editionSchema.safeParse(invalidMedia).success).toBe(false);
  });

  it('accepts supported social discovery channels and timestamped metrics', () => {
    const social = structuredClone(edition);
    social.articles[0].channels = ['togetter', 'reddit', '4chan'];
    social.articles[0].metrics = {
      togetterViews: 1200,
      redditScore: 450,
      redditComments: 80,
      fourChanReplies: 35,
      socialMetricsCheckedAt: '2026-10-24T11:00:00+09:00',
    };
    expect(editionSchema.safeParse(social).success).toBe(true);
  });

  it('accepts a neutral attention analysis and rejects an unsupported assessment', () => {
    const reviewed = structuredClone(edition);
    reviewed.articles[0].attentionAnalysis = {
      whyNotable: '利用者情報に関わる可能性があり、影響範囲の確定まで継続確認が必要です。',
      currentReaction: '発表直後で反応はまだ限定的で、主に安全性を扱う読者が注目しています。',
      assessment: '判断には早い',
      assessmentComment: '漏えいの有無と対象範囲が未確定であり、現時点では断定的な評価を避ける段階です。',
    };
    expect(editionSchema.safeParse(reviewed).success).toBe(true);
    reviewed.articles[0].attentionAnalysis.assessment = '大炎上';
    expect(editionSchema.safeParse(reviewed).success).toBe(false);
  });

  it('requires verified origin, materials, spread, reaction, and rights notes for media trends', () => {
    const trendEdition = structuredClone(edition);
    const article = trendEdition.articles[0];
    article.categories = ['ネット文化・ミーム'];
    article.informationType = 'ミーム・ネット文化';
    expect(editionSchema.safeParse(trendEdition).success).toBe(false);

    article.mediaTrend = {
      formats: ['短尺動画', 'ミーム'],
      origin: {
        status: '確認済み',
        platform: 'YouTube Shorts',
        creatorName: 'Example Creator',
        accountHandle: '@example',
        originalUrl: 'https://example.com/original',
        postedAt: '2026-10-24T10:00:00+09:00',
        explanation: '投稿者の公式アカウント、投稿日時、動画内容を照合し、確認できた範囲ではこの投稿が起点です。転載版より前に公開されていることも確認しました。投稿者自身の説明と後続の派生投稿から参照されているURLも一致しています。',
      },
      sourceMaterialAnalysis: '映像の元ネタは公開作品の一場面を模した演出ですが、作品本編を切り抜いたものではありません。制作者自身の説明と公式資料を照合しました。構図とセリフのどの部分が参照され、どの部分が投稿者独自の改変なのかも分けて確認しています。',
      sourceMaterials: [{
        kind: '映画・番組', title: 'Example Work', creator: 'Example Studio',
        sourceUrl: 'https://example.com/work', identificationStatus: '確認済み',
        rightsStatus: '公式投稿へのリンクのみ', note: '制作者が元ネタとして明記しており、公式作品ページでも名称を確認しました。',
      }],
      musicAnalysis: 'BGMは投稿画面の公式音源表示と権利者の配信ページを照合しました。本サイトでは音源を転載せず、確認用リンクだけを掲載します。',
      music: [{
        kind: '音楽', title: 'Example Song', creator: 'Example Artist',
        sourceUrl: 'https://example.com/song', identificationStatus: '確認済み',
        rightsStatus: '公式投稿へのリンクのみ', note: '公式音源ページと動画側の音源クレジットが一致することを確認しました。',
      }],
      spread: [{
        platform: 'Reddit', observedAt: '2026-10-25T08:00:00+09:00',
        evidence: '複数のサブコミュニティで派生動画と元ネタ解説が共有され、模倣形式へ広がっていました。',
        exampleUrl: 'https://example.com/reddit-example',
      }],
      reactionSummary: '元動画そのものへの好意的な反応に加え、撮影方法を再現する派生動画や、元ネタを説明する投稿が複数のコミュニティで確認されました。一方で、同じ形式の投稿が増えすぎたという飽和への反応や、企業アカウントによる利用への批判も分けて確認しています。',
      neutralAssessment: '複数媒体への広がりは確認できますが、観測範囲は公開投稿に限られます。再生数だけで支持や長期的な定着を判断せず、派生の継続を確認する段階です。広告出稿や推薦アルゴリズムによる露出も考えられるため、自然発生の人気だけで説明しない評価にします。',
      rightsAndSafety: '動画、音源、作品画像は転載せず、元投稿と権利者の公式ページへのリンクだけを使います。投稿者の個人情報や削除済み投稿を追跡せず、二次被害につながる内容も含めません。楽曲名の特定と再利用許諾は別であり、本サイトが音源や映像を利用できるという意味ではないことも明記します。',
    };
    expect(editionSchema.safeParse(trendEdition).success).toBe(true);

    article.mediaTrend.origin.originalUrl = null;
    expect(editionSchema.safeParse(trendEdition).success).toBe(false);
  });
});
