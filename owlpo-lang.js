/* Owlry UI strings — Chinese */
(function (global) {
  var STORAGE_KEY = 'owlpo.lang';
  var current = "en";
  var snapshots = Object.create(null);
  var placeholderSnap = Object.create(null);
  var ariaSnap = Object.create(null);

  var ZH = 
  {
    "doc.title": "Owlry",
    "nav.brand": "Owlry",
    "nav.brandAria": "Owlry 首页",
    "nav.login": "\u767b\u5f55",
    "nav.join": "\u52a0\u5165",
    "nav.langLabel": "\u8bed\u8a00",
    "mobilecta.label": "\u9884\u7ea6\u4f60\u7684\u5e2d\u4f4d \u2014 <strong>\u514d\u8d39</strong>",
    "mobilecta.seats": "\u521b\u59cb\u5e2d\u4f4d\u8fd8\u5269 143",
    "mobilecta.aria": "\u9884\u7ea6\u4f60\u7684\u5e2d\u4f4d\uff0c\u514d\u8d39",
    "functions.tablistAria": "Owlry 功能",
    "hero.eyebrow": "\u6211\u9605\u8bfb\uff0c\u6545\u6211\u5728\u3002",
    "hero.title": "\u4f60\u7684<em>\u79c1\u4eba</em>\u5bfb\u4e66\u79d8\u4e66",
    "hero.scarcity": "\u9996\u671f <strong>200</strong> \u5e2d\uff0c\u4ec5\u4f59 <strong>143</strong> \u4e2a\u540d\u989d\u3002",
    "hero.cta": "\u9884\u7ea6\u6211\u7684\u540d\u989d",
    "hero.ctaAria": "\u9884\u7ea6\u6211\u7684\u540d\u989d",
    "hero.queue": "\u5df2\u6709 <strong>247</strong> \u4f4d\u8bfb\u8005\u5728\u961f\u3002",
    "hero.queueAria": "\u8bfb\u8005\u6392\u961f",
    "hero.scroll": "\u7ffb\u9875",
    "hero.scrollAria": "\u6eda\u52a8\u5230\u4e0b\u4e00\u90e8\u5206",
    "functions.eyebrow": "Owlry 如何工作",
    "functions.title": "\u968f\u4fbf\u95ee\u3002<br>\u6362\u56de\u4e00\u672c<em>\u4e66</em>\u3002",
    "functions.sub": "\u70b9\u4e00\u4e2a\u95ee\u9898\u3002\u5e26\u56de\u4e00\u672c\u4e66\u3002<br>\u7b2c\u4e00\u5c01\u4fe1\u6211\u4eec\u8bf7\u5ba2\u2014\u2014\u5176\u4f59\u4f1a\u62b5\u8fbe\u4f60\u7684\u6536\u4ef6\u7bb1\u3002",
    "tab.discover": "\u53d1\u73b0\u597d\u4e66",
    "tab.ask": "\u968f\u4fbf\u95ee",
    "tab.skip": "\u8df3\u8fc7\u65e0\u5173\u9875",
    "tab.sharper": "\u53d8\u5f97\u66f4\u654f\u9510",
    "tab.discoverShort": "\u53d1\u73b0",
    "tab.askShort": "\u95ee",
    "tab.skipShort": "\u8df3\u8bfb",
    "tab.sharperShort": "\u654f\u9510",
    "discover.h3": "\u6309<em>\u5fc3\u60c5\u4e0e\u573a\u666f</em>\u53d1\u73b0\u597d\u4e66\u3002",
    "discover.p1": "睡前？清晨？公园里的阳光午后？告诉 Owlry 就好。我们能读懂你的情绪、天气，或你最近想解决的问题——找到<span class=\"accent\">此刻</span>最该读的那一本。",
    "discover.try": "\u8bd5\u4e00\u8bd5 <span class=\"arrow\">\u2192</span>",
    "demo.brand": "Owlry",
    "demo.live": "\u6f14\u793a",
    "discover.bubble": "\u544a\u8bc9\u6211\u4f60\u73b0\u5728\u5728\u54ea\u91cc <span class=\"sparkle\">\u2726</span> \u2014\u2014 \u6211\u4f1a\u627e\u5230\u4e3a\u8fd9\u4e00\u523b\u800c\u751f\u7684\u4e66\u3002",
    "chip.d1": "<span class=\"chip-icon\">\ud83c\udf19</span>\u4eca\u665a\u7761\u524d",
    "chip.d2": "<span class=\"chip-icon\">\u2600</span>\u6e05\u6668\uff0c\u51c6\u5907\u51fa\u53d1",
    "chip.d3": "<span class=\"chip-icon\">\ud83c\udf43</span>\u6175\u61d2\u7684\u5468\u65e5\u4e0b\u5348",
    "ask.h3": "\u968f\u4fbf\u95ee\u3002\u6362\u4e00\u672c<em>\u4e66</em>\u4f5c\u7b54\u3002",
    "ask.p1": "\u6709\u4e9b\u95ee\u9898\u4e0d\u8be5\u4ea4\u7ed9\u6cdb\u6cdb\u7684\u804a\u5929\u673a\u5668\u4eba\u3002\u804c\u4e1a\u5371\u673a\u3001\u5206\u624b\u3001\u6700\u91ce\u7684\u68a6\u3002\u6bcf\u4e2a\u8ba9\u4f60\u7761\u4e0d\u7740\u7684\u7591\u95ee\uff0c\u90fd\u65e9\u6709\u4e00\u4f4d\u4f5c\u8005\u7528\u4e00\u751f\u53bb\u5199\u3002<span class=\"accent\">\u522b\u88ab AI \u7684\u566a\u97f3\u6df9\u6ca1\u3002</span>",
    "ask.try": "\u8bd5\u4e00\u8bd5 <span class=\"arrow\">\u2192</span>",
    "ask.bubble": "\u662f\u4ec0\u4e48\u95ee\u9898\u8ba9\u4f60\u7761\u4e0d\u7740 <span class=\"sparkle\">\u2726</span> \u2014\u2014 \u6211\u4f1a\u627e\u5230\u5e26\u7740\u7b54\u6848\u7684\u90a3\u672c\u4e66\u3002",
    "chip.a1": "<span class=\"chip-icon\">🌙</span>今晚，睡前",
    "chip.a2": "<span class=\"chip-icon\">\ud83d\udeaa</span>\u8981\u4e0d\u8981\u79bb\u5f00\u7a33\u5b9a\u5de5\u4f5c\u53bb\u8ffd\u4e00\u4ef6\u4e8b\uff1f",
    "chip.a3": "<span class=\"chip-icon\">\ud83d\udc94</span>\u4e3a\u4ec0\u4e48\u6211\u603b\u662f\u7231\u4e0a\u540c\u4e00\u7c7b\u4eba\uff1f",
    "skip.h3": "\u4e66\u76ee\u9884\u89c8\uff0c<em>\u4e3a\u4f60\u7684\u95ee\u9898</em>\u91cf\u8eab\u5b9a\u5236\u3002",
    "skip.p1": "\u6709\u4e9b\u4e66\u4e0d\u503c\u5f97\u8bfb\u6ee1\u4e09\u767e\u9875\uff1b\u53e6\u4e00\u4e9b\u6bcf\u4e00\u884c\u90fd\u662f\u5b9d\u3002\u544a\u8bc9\u6211\u4eec\u4f60\u7684\u95ee\u9898\uff0c\u6211\u4eec\u4f1a\u628a\u7ae0\u8282\u3001\u6d1e\u89c1\u3001\u6bb5\u843d<span class=\"accent\">\u4e3a\u4f60\u5199\u597d</span>\u2014\u2014\u4f60\u518d\u51b3\u5b9a\u6df1\u8bfb\uff0c\u8fd8\u662f\u8f6c\u8eab\u79bb\u5f00\u3002",
    "skip.try": "\u8bd5\u4e00\u8bd5 <span class=\"arrow\">\u2192</span>",
    "skip.bubble": "\u9009\u4e00\u672c\u4e66\uff0c\u544a\u8bc9\u6211\u4f60\u7684\u89d2\u5ea6 <span class=\"sparkle\">\u2726</span> \u2014\u2014 \u6211\u4f1a\u62bd\u51fa\u771f\u6b63\u91cd\u8981\u7684\u7ae0\u8282\u3002",
    "chip.s1": "<span class=\"chip-icon\">\ud83d\udcd5</span>\u300a\u539f\u5b50\u4e60\u60ef\u300b\u2014\u2014\u7ed9\u603b\u662f\u91cd\u65b0\u5f00\u59cb\u7684\u4eba",
    "chip.s2": "<span class=\"chip-icon\">\ud83d\udcd7</span>\u300a\u91d1\u94b1\u5fc3\u7406\u5b66\u300b\u2014\u2014\u7ed9\u5927\u5b66\u751f",
    "chip.s3": "<span class=\"chip-icon\">\ud83d\udcd9</span>\u300a\u4eba\u7c7b\u7b80\u53f2\u300b\u2014\u2014\u7ed9\u65e9\u671f\u521b\u4e1a\u8005",
    "sharper.h3": "\u8bb0\u5f55\u9605\u8bfb\u53f2\u3002\u770b\u89c1\u81ea\u5df1<em>\u6210\u957f\u3002</em>",
    "sharper.p1": "遇见你的<span class=\"accent\">阅读身份</span>。每读完一本书都会留下痕迹——这一次，你能看见自己正在成为的那个读者。读起来，升级！晒给朋友看！",
    "sharper.try": "\u8bd5\u4e00\u8bd5 <span class=\"arrow\">\u2192</span>",
    "sharper.ledger": "阅读身份",
    "sharper.tierStripAria": "\u6210\u957f\u9636\u6bb5",
    "sharper.expAria": "\u9636\u6bb5\u7ecf\u9a8c\u503c",
    "sharper.radarWrapAria": "\u793a\u4f8b\uff1a\u9605\u8bfb\u6210\u957f\u96f7\u8fbe\u56fe",
    "sharper.radarTitle": "\u9605\u8bfb\u6210\u957f\u96f7\u8fbe",
    "sharper.radarDesc": "Owlry 学徒\u5728\u5065\u5eb7\u3001\u5173\u7cfb\u3001\u6295\u8d44\u3001\u804c\u4e1a\u3001\u5fc3\u6001\u4e0e\u6587\u5b66\u4e0a\u7684\u6210\u957f\u3002",
    "radar.h": "\u5065\u5eb7",
    "radar.r": "\u5173\u7cfb",
    "radar.i": "\u6295\u8d44",
    "radar.c": "\u804c\u4e1a",
    "radar.m": "\u5fc3\u6001",
    "radar.l": "\u6587\u5b66",
    "intermission.eyebrow": "\u2014 \u5e55\u95f4 \u2014",
    "intermission.title": "\u4e00\u5219\u77ed\u6545\u4e8b\uff1a\u4e3a\u4ec0\u4e48\u5fc5\u987b\u6709 Owlry\u3002",
    "beat1.eyebrow": "第 1 章",
    "beat1.title": "AI 在升级。<br>我们却在<span class=\"title-fall\">下滑。</span>",
    "beat1.body": "我们正身处人类历史上最喧嚣的时代。Feed 永不停歇。无尽刷动灼烧大脑。人类从未有过这么多东西可读——却越来越少读懂自己。当 AI 每秒都在变聪明——我们却一天比一天分心。",
    "beat2.eyebrow": "第 2 章",
    "beat2.title": "那间安静的房间。",
    "beat2.body": "翻开一本书，喧嚣便止。你与尼采、亚里士多德、奥斯汀同坐——感受他们所感、与他们一同思考，再抵达属于自己的地方。没什么比这更能训练心智。一分一秒都不算浪费。",
    "beat3.eyebrow": "第 3 章",
    "beat3.title": "拥挤的书架。",
    "beat3.body": "但对的那一本书被埋没了。难找、难下手、易遗忘。那本可能改写你下一个重大人生决定的书，搁在永远拥挤到够不到的书架上。",
    "beat3.cta": "\u9884\u7ea6\u540d\u989d \u2014\u2014 \u514d\u8d39",
    "beat4.eyebrow": "第 4 章",
    "beat4.title": "Owlry 来了：<br>你的<span class=\"beat-title-wax\">私人</span>寻书秘书。",
    "beat4.body": "按心情与场景发现书。只预览值得你时间的内容。记录每一本留下痕迹的书。问任何问题——对的那一本书自会找到你。你不再向下刷。你开始向上升级。",
    "beat4.cta": "\u9884\u7ea6\u540d\u989d \u2014\u2014 \u514d\u8d39",
    "beat4.svgNote": "\u5bf9\u7684\u4e66\u5728\u54ea\u91cc\uff1f",
    "beat5.eyebrow": "\u7b2c\u4e94\u7ae0",
    "beat5.title": "\u4ecb\u7ecd Owlry\uff1a<br>\u4f60\u7684<span class=\"beat-title-wax\">\u79c1\u4eba</span>\u5bfb\u4e66\u79d8\u4e66",
    "beat5.body": "\u6309\u5fc3\u60c5\u4e0e\u65f6\u523b\u53d1\u73b0\u4e66\u3002\u53ea\u9884\u89c8\u4e0e\u4f60\u76f8\u5173\u7684\u5185\u5bb9\u3002\u8ffd\u8e2a\u6bcf\u4e00\u672c\u7559\u4e0b\u5370\u8bb0\u7684\u4e66\u3002\u968f\u4fbf\u95ee\u2014\u2014Owlry \u7528\u4e00\u672c\u4e66\u56de\u5e94\u4f60\u3002\u5c31\u50cf\u4e00\u4f4d\u771f\u6b63\u61c2\u4f60\u7684\u79c1\u4eba\u9986\u5458\uff0c\u603b\u5728\u6307\u5c16\u3002",
    "beat5.cta": "\u9884\u7ea6\u540d\u989d \u2014\u2014 \u514d\u8d39",
    "closing.eyebrow": "\u5c3e\u58f0 \u2014 \u4e00\u573a\u8fd0\u52a8",
    "closing.headline": "\u6211\u9605\u8bfb\uff0c<br><em>\u6545\u6211\u5728\u3002</em>",
    "closing.manifesto": "\u8fd9\u4e0d\u662f\u4e00\u6b21\u5e94\u7528\u53d1\u5e03\u3002\u800c\u662f\u4e00\u6b21\u5411\u6df1\u5ea6\u7684\u5c0f\u5c0f\u7684\u56de\u5f52\u2014\u2014<br>\u5411\u601d\u8003\uff0c\u5411\u90a3\u4e9b\u8de8\u8d8a\u5386\u53f2\u4e16\u4ee3\u7559\u4e0b\u5370\u8bb0\u7684\u4e66\u3002",
    "closing.queueAria": "\u8bfb\u8005\u6392\u961f",
    "closing.queue": "<strong>247</strong> \u4f4d\u8bfb\u8005\u5df2\u52a0\u5165 &nbsp;\u00b7&nbsp; <span class=\"closing-seats\">\u521b\u59cb\u5e2d\u4f4d\u8fd8\u5269 143</span>",
    "closing.cta": "\u6210\u4e3a\u521b\u59cb\u8bfb\u8005",
    "reserve.eyebrow": "\u9884\u7ea6\u5e2d\u4f4d",
    "reserve.title": "\u52a0\u5165 Owlry",
    "tier.free.h3": "\u514d\u8d39\u5e2d\u4f4d",
    "tier.free.tag": "\u961f\u5217\u4e2d\u7684\u4e00\u4e2a\u4f4d\u7f6e\u3002",
    "tier.free.price": "<strong>\u514d\u8d39</strong>\uff0c\u516c\u6d4b\u671f\u95f4\u59cb\u7ec8\u514d\u8d39\u3002",
    "tier.free.li1": "<strong>\u4f60\u7684\u8bfb\u8005\u7f16\u53f7\uff0c</strong> <span class=\"desc\">\u8bb0\u5f55\u5728\u518c\uff0c\u770b\u5b83\u6162\u6162\u5411\u524d\u3002</span>",
    "tier.free.li2": "<strong>Owlry\u5f00\u95e8\u65f6\u7684\u4e00\u4e2a\u6708\u514d\u8d39\u4f7f\u7528\u6743</strong> <span class=\"desc\">\u3002</span>",
    "tier.free.li3": "<strong>Owlry 来信\u53ea\u5728\u4f60\u51c6\u5907\u597d\u65f6\u51fa\u73b0</strong> <span class=\"desc\">\u2014\u2014\u65e0\u5783\u573e\u90ae\u4ef6\u3001\u65e0\u50ac\u4fc3\u3001\u65e0\u8425\u9500\u566a\u97f3\u3002</span>",
    "tier.free.li4": "<strong>\u4e00\u6761\u79c1\u5bc6\u9080\u8bf7\u94fe\u63a5</strong> <span class=\"desc\">\uff0c\u4e0e\u4f60\u4fe1\u4efb\u7684\u670b\u53cb\u4e00\u8d77\u5411\u524d\u6392\u961f\u3002</span>",
    "tier.free.meta": "<strong>247 \u4f4d\u8bfb\u8005</strong>\u5728\u961f\u5217\u4e2d\u3002",
    "tier.free.btn": "\u9884\u7ea6\u6211\u7684\u5e2d\u4f4d \u2192 \u514d\u8d39",
    "tier.free.status": "\u8bfb\u8005 <strong>#248</strong> \u662f\u8d26\u7c3f\u4e0a\u7684\u4e0b\u4e00\u4e2a\u53f7\u7801\u3002",
    "tier.founding.badge": "\u5269\u4f59 143",
    "tier.founding.h3": "\u521b\u59cb\u5e2d\u4f4d",
    "tier.founding.tag": "\u5f00\u5e55\u4e4b\u591c\u7684\u4e00\u5f20\u6905\u5b50\u3002",
    "tier.founding.price": "<strong>\u4e00\u6b21\u6027 $7.97</strong> \u00b7 <strong>\u7ec8\u8eab $9.90/\u6708</strong>\u3002",
    "tier.founding.li1": "<strong>\u5f00\u5e55\u591c\u4f18\u5148\u6743</strong> <span class=\"desc\">\u2014\u2014\u6bd4\u4efb\u4f55\u4eba\u90fd\u5148\u5199\u4fe1\u7ed9 Owlry\u3002</span>",
    "tier.founding.li2": "<strong>$9.90/\u6708\u7ec8\u8eab\u9501\u5b9a\uff0c</strong> <span class=\"desc\">\u6c38\u4e0d\u4e0a\u8c03\uff0c\u5373\u4fbf\u6b63\u5f0f\u4e0a\u67b6\u4e4b\u540e\u3002</span>",
    "tier.founding.li3": "<strong>\u521b\u59cb\u8bfb\u8005\u5fbd\u7ae0</strong> <span class=\"desc\">\u76d6\u5728\u4f60\u7684\u9605\u8bfb\u8eab\u4efd\u4e0a\u3002</span>",
    "tier.founding.li4": "<strong>\u4e0b\u4e00\u7a0b\u4ea7\u54c1\u7531\u4f60\u6295\u7968</strong> <span class=\"desc\">\u2014\u2014\u521b\u59cb\u8bfb\u8005\u5851\u9020 Owlry\u3002</span>",
    "tier.founding.meta": "<strong>200 \u4e2a\u521b\u59cb\u5e2d\u4f4d</strong> \u00b7 <strong>\u8fd8\u5269 143\u3002</strong>",
    "tier.founding.btn": "\u6210\u4e3a\u521b\u59cb\u8bfb\u8005 \u2192",
    "tier.founding.status": "\u521b\u59cb\u5e2d\u4f4d <strong>#58</strong> \u662f\u4e0b\u4e00\u4e2a\u53f7\u7801\u3002",
    "tier.emailLabel": "\u7535\u5b50\u90ae\u7bb1",
    "tier.emailPh": "your.name@email.com",
    "tier.inviteLabel": "\u9080\u8bf7\u7801\uff08\u53ef\u9009\uff09",
    "tier.invitePh": "\u9080\u8bf7\u7801\uff08\u53ef\u9009\uff09",
    "faq.eyebrow": "\u95ee\u7b54",
    "faq.title": "\u4eba\u4eec\u5728\u52a0\u5165\u524d<br>\u5e38\u95ee\u7684\u4e8b\u3002",
    "faq.q1": "Owlry \u5230\u5e95\u662f\u4ec0\u4e48\uff1f<span class=\"faq-icon\">+</span>",
    "faq.a1": "Owlry \u662f\u4f60\u7684\u5bfb\u4e66\u79d8\u4e66\u2014\u2014\u5e2e\u4f60\u6309\u5fc3\u60c5\u3001\u65f6\u523b\u4e0e\u62b1\u8d1f\u627e\u5230\u5bf9\u7684\u4e66\u3002\u4e0e\u5176\u65e0\u5c3d\u6d4f\u89c8\uff0c\u4e0d\u5982\u63cf\u8ff0\u4f60\u8981\u4ec0\u4e48\uff0cOwlry \u4e3a\u4f60\u53d6\u56de\u3002\u50cf\u4e00\u4f4d\u771f\u6b63\u61c2\u4f60\u7684\u79c1\u4eba\u9986\u5458\u3002",
    "faq.q2": "\u514d\u8d39\u5e2d\u4f4d\u771f\u7684\u514d\u8d39\u5417\uff1f<span class=\"faq-icon\">+</span>",
    "faq.a2": "\u662f\u7684\u3002\u514d\u8d39\u5e2d\u4f4d\u5728\u4e0a\u7ebf\u65f6\u5373\u53ef\u4f7f\u7528 Owlry\uff0c\u65e0\u9700\u4ed8\u6b3e\u3002\u6c38\u8fdc\u3002\u4f60\u5c06\u83b7\u5f97\u53d1\u73b0\u3001\u9884\u89c8\u4e0e\u57fa\u7840\u9605\u8bfb\u8ffd\u8e2a\u2014\u2014\u65e0\u9700\u4fe1\u7528\u5361\u3001\u65e0\u8bd5\u7528\u671f\u3001\u6ca1\u6709\u5957\u8def\u3002\u521b\u59cb\u5e2d\u4f4d\u9002\u5408\u60f3\u9501\u5b9a\u7ec8\u8eab\u4ef7\u683c\u5e76\u53c2\u4e0e\u5851\u9020\u4ea7\u54c1\u7684\u4eba\u3002",
    "faq.q3": "Owlry \u4f55\u65f6\u4e0a\u7ebf\uff1f<span class=\"faq-icon\">+</span>",
    "faq.a3": "\u6211\u4eec\u5c1a\u672a\u516c\u5e03\u65e5\u671f\u2014\u2014\u5b81\u613f\u505a\u5bf9\uff0c\u4e5f\u4e0d\u613f\u62a2\u5feb\u3002\u5019\u8865\u540d\u5355\u4e0a\u7684\u8bfb\u8005\u4f1a\u6700\u5148\u77e5\u9053\uff1b\u521b\u59cb\u5e2d\u4f4d\u6301\u6709\u8005\u5728\u6240\u6709\u4eba\u4e4b\u524d\u8fdb\u5165\u3002\u767b\u8bb0\u540e\uff0cOwlry\u5f00\u95e8\u65f6\u6211\u4eec\u4f1a\u5199\u4fe1\u544a\u8bc9\u4f60\u3002",
    "faq.q4": "\u8fd9\u548c Goodreads \u6216 StoryGraph \u6709\u4ec0\u4e48\u4e0d\u540c\uff1f<span class=\"faq-icon\">+</span>",
    "faq.a4": "\u90a3\u4e9b\u662f\u8bb0\u5f55\u4e0e\u8bc4\u5206\u5de5\u5177\u3002Owlry \u662f\u53d1\u73b0\u5de5\u5177\u2014\u2014\u91cd\u70b9\u662f\u627e\u5230\u4e0b\u4e00\u672c\u4e66\uff0c\u800c\u4e0d\u662f\u76d8\u70b9\u5df2\u8bfb\u3002\u4f60\u53ef\u4ee5\u95ee\u4efb\u4f55\u4e8b\uff08\u300c\u5468\u65e5\u60f3\u8bfb\u70b9\u5b89\u9759\u7684\u300d\u300c\u60f3\u6362\u79cd\u65b9\u5f0f\u7406\u89e3\u91d1\u94b1\u300d\uff09\uff0cOwlry \u7ed9\u4f60\u7cbe\u5fc3\u7b56\u5c55\u7684\u7b54\u6848\uff0c\u800c\u4e0d\u662f\u4e09\u5343\u6761\u7ed3\u679c\u3002",
    "faq.q5": "\u521b\u59cb\u5e2d\u4f4d\u5305\u542b\u4ec0\u4e48\uff1f<span class=\"faq-icon\">+</span>",
    "faq.a5": "\u4e00\u6b21\u6027\u652f\u4ed8 $7.97\uff0c\u5373\u53ef\u7ec8\u8eab\u9501\u5b9a $9.90/\u6708\u2014\u2014\u5373\u4fbf\u6211\u4eec\u65e5\u540e\u6da8\u4ef7\u3002\u4f60\u8fd8\u6bd4\u514d\u8d39\u5c42\u66f4\u65e9\u83b7\u5f97\u5f00\u5e55\u591c\u4f7f\u7528\u6743\u3001\u5728\u9605\u8bfb\u8eab\u4efd\u4e0a\u83b7\u5f97\u521b\u59cb\u5fbd\u7ae0\uff0c\u4ee5\u53ca\u5bf9\u4e0b\u4e00\u7a0b\u529f\u80fd\u7684\u6295\u7968\u6743\u3002\u521b\u59cb\u5e2d\u4f4d\u53ea\u6709 200 \u4e2a\u3002",
    "faq.q6": "\u6211\u7684\u6570\u636e\u4e0e\u4e66\u67b6\u4f1a\u600e\u6837\uff1f<span class=\"faq-icon\">+</span>",
    "faq.a6": "\u4f60\u7684\u9605\u8bfb\u5c5e\u4e8e\u4f60\u3002\u6211\u4eec\u4e0d\u51fa\u552e\u4f60\u7684\u6570\u636e\uff0c\u4e0d\u7528\u4f60\u7684\u4e66\u5e93\u8bad\u7ec3\u6a21\u578b\uff0c\u4e0d\u4e0e\u7b2c\u4e09\u65b9\u5206\u4eab\u3002\u4e66\u67b6\u9ed8\u8ba4\u79c1\u5bc6\u3002\u6211\u4eec\u50cf\u4e00\u4f4d\u597d\u9986\u5458\u4e00\u6837\u770b\u5f85\u4f60\u7684\u9605\u8bfb\u751f\u6d3b\uff1a\u5ba1\u614e\u3001\u5c0a\u91cd\u3001\u5168\u7136\u4e3a\u4f60\u670d\u52a1\u3002",
    "faq.q7": "\u6211\u4e0d\u5e38\u8bfb\u4e66\uff0cOwlry \u9002\u5408\u6211\u5417\uff1f<span class=\"faq-icon\">+</span>",
    "faq.a7": "\u5c24\u5176\u9002\u5408\u3002Owlry \u4e3a\u60f3\u591a\u8bfb\u5374\u4e0d\u77e5\u4ece\u4f55\u5f00\u59cb\u7684\u4eba\u800c\u9020\u2014\u2014\u4e0d\u662f\u4e3a\u90a3\u4e9b\u4e66\u5806\u5df2\u7ecf\u9876\u5929\u7684\u4eba\u3002\u82e5\u56e0 Owlry \u800c\u8bfb\u5b8c\u4e00\u672c\u597d\u4e66\uff0c\u5c31\u662f\u80dc\u5229\u3002Owlry \u5c5e\u4e8e\u597d\u5947\u8005\uff0c\u800c\u975e\u53ea\u670d\u52a1\u8d44\u6df1\u4e66\u866b\u3002",
    "footer.brand": "Owlry",
    "footer.est": "Est. 2025 \u00b7 Owlry",
    "footer.quote": "\u300c\u4e00\u5c01\u4fe1\u5230\u4e86\u3002\u706b\u6f06\u5c1a\u6e29\u3002\u300d",
    "footer.twitter": "\u63a8\u7279",
    "footer.insta": "\u7167\u7247\u5899",
    "footer.email": "\u90ae\u4ef6",
    "footer.privacy": "\u4f60\u7684\u9605\u8bfb\u5c5e\u4e8e\u4f60\u3002\u6211\u4eec\u4e0d\u51fa\u552e\u4f60\u7684\u5730\u5740\uff0c\u4e0d\u7528\u4f60\u7684\u4e66\u67b6\u8bad\u7ec3\u6a21\u578b\uff0c\u4e5f\u4e0d\u4f1a\u53d1\u9001\u4f60\u672a\u7d22\u53d6\u7684\u4efb\u4f55\u5185\u5bb9\u3002",
    "login.closeAria": "\u5173\u95ed\u767b\u5f55",
    "login.eyebrow": "Owlry",
    "login.title": "\u6b22\u8fce\u56de\u6765\u3002",
    "login.sub": "<em>\u6211\u9605\u8bfb\uff0c\u6545\u6211\u5728\u3002</em>",
    "login.labelEmail": "\u7535\u5b50\u90ae\u7bb1",
    "login.phEmail": "your.name@email.com",
    "login.labelPw": "\u5bc6\u7801",
    "login.forgot": "\u5fd8\u8bb0\u5bc6\u7801\uff1f",
    "login.showPwAria": "\u663e\u793a\u5bc6\u7801",
    "login.hidePwAria": "\u9690\u85cf\u5bc6\u7801",
    "login.remember": "\u8bb0\u4f4f\u6211",
    "login.createAccount": "\u521b\u5efa\u8d26\u6237",
    "login.errDefault": "\u90ae\u7bb1\u6216\u5bc6\u7801\u4e0d\u6b63\u786e\u3002",
    "login.submit": "\u6253\u5f00 Owlry \u2192",
    "login.footer2": "\u6709\u79c1\u5bc6\u9080\u8bf7\u7801\uff1f<a href=\"#invite-code\" id=\"loginInviteCode\">\u5728\u6b64\u8f93\u5165</a>",
    "login.seatLabel": "\u4f60\u7684\u5e2d\u4f4d\u53f7",
    "login.streakLabel": "\u5929\u8fde\u7eed\u9605\u8bfb",
    "login.signedEyebrow": "\u5df2\u767b\u5f55",
    "login.welcomeTitleDefault": "\u5bf9\u7684\u4e66\u4f1a\u627e\u5230\u4f60\u3002",
    "login.welcomeInsightDefault": "\u4e13\u6ce8\u662f\u6700\u7a00\u6709\u7684\u52c7\u6c14\u4e4b\u4e00\u3002Owlry \u8ba9\u4f60\u7684\u4e66\u67b6\u4fdd\u6301\u8bda\u5b9e\u2014\u2014\u4e00\u5c01\u4fe1\uff0c\u4e00\u6761\u63a8\u8350\uff0c\u4e00\u6b21\u5b89\u9759\u7684\u5c0f\u80dc\u5229\u3002",
    "login.welcomeCta": "\u6253\u5f00 Owlry \u2192",
    "login.welcomeNoteDefault": "\u4f60\u7684\u53f0\u706f\u4eae\u7740\u3002\u6211\u4eec\u4f1a\u8bb0\u4f4f\u8fd9\u4f4d\u8bfb\u8005\u3002",
    "wait.errEmail": "\u8bf7\u8f93\u5165\u6709\u6548\u90ae\u7bb1\uff0c\u597d\u8ba9\u4fe1\u4f7f\u77e5\u9053\u98de\u5f80\u4f55\u5904\u3002",
    "wait.sending": "\u53d1\u9001\u4e2d\u2026",
    "wait.successFounding": "\u521b\u59cb\u5e2d\u4f4d\u5df2\u4e3a\u4f60\u9884\u7559\u3002\u5f00\u95e8\u65f6\uff0c\u706b\u6f06\u4ecd\u4f1a\u6e29\u70ed\u3002",
    "wait.successFreeTpl": "\u8bfb\u8005 #{n} \u2014\u2014 \u4f60\u7684\u4fe1\u51fd\u6b63\u5728\u64b0\u5199\u3002\u65f6\u673a\u5230\u4e86\uff0cOwlry \u4f1a\u5199\u4fe1\u7ed9\u4f60\u3002",
    "wait.errSend": "\u4fe1\u51fd\u672a\u80fd\u5bc4\u51fa\u3002\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002",
    "login.founderWelcomePrefix": "\u6b22\u8fce\u56de\u6765\uff0c",
    "login.founderQuote": "\u201c\u90a3\u4e9b\u75af\u5230\u8db3\u4ee5\u4e3a\u81ea\u5df1\u80fd\u6539\u53d8\u4e16\u754c\u7684\u4eba\uff0c\u624d\u771f\u6b63\u6539\u53d8\u4e86\u5b83\u3002\u201d - Steve Jobs",
    "login.founderNote": "\u53d1\u73b0\u3001\u9884\u89c8\u3001\u8ffd\u8e2a\u597d\u4e66 \u2014\u2014 \u96c6\u4e8e\u4e00\u5904\u3002",
    "login.errWrongPw": "\u5bc6\u7801\u9519\u8bef\u3002",
    "demo.stateTyping": "\u6b63\u5728\u8bfb\u4f60\u7684\u6b64\u523b",
    "demo.stateFound": "\u8fd9\u662f\u6211\u4e3a\u4f60\u627e\u5230\u7684",
    "demo.gateTag": "\u6709\u4e00\u5c01\u4fe1\u5728\u7b49\u4f60",
    "demo.gateMeta": "\u65e0\u5783\u573a\u90ae\u4ef6 \u00b7 \u4e00\u5c01\u4fe1\uff0c\u9664\u975e\u4f60\u70b9\u5934\uff0c\u5426\u5219\u518d\u65e0\u6253\u6270",
    "demo.successTitle": "\u4f60\u7684<em>\u4fe1</em>\u5728\u8def\u4e0a\u4e86",
    "demo.successMsg": "Owlry 正在写\u3002\u5b8c\u6574\u7b54\u6848\u7ea6\u5728<strong>\u4e24\u5206\u949f\u5185</strong>\u62b5\u8fbe\u4f60\u7684\u6536\u4ef6\u7bb1\uff08\u4e5f\u8bf7\u770b\u4e00\u773c\u63a8\u5e7f\u680f\uff09\u3002",
    "demo.successRestart": "\u6362\u4e2a\u95ee\u9898\u518d\u8bd5 \u2192",
    "demo.chaptersPickTag": "\u4e13\u5c5e\u4e8e\u4f60\u7684\u7ae0\u8282\u9884\u89c8",
    "demo.chaptersBlurb": "\u4ece\u4e66\u4e2d\u62bd\u51fa\u7684 3 \u7ae0\u2014\u2014\u53ea\u7559\u4e0e\u4f60\u95ee\u9898\u76f8\u5173\u7684\u90e8\u5206\u3002",
    "submit.errGeneric": "\u51fa\u4e86\u70b9\u95ee\u9898\uff0c\u8bf7\u91cd\u8bd5\u3002"
  };

  function captureSnapshots() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (!k) return;
      snapshots[k] = el.innerHTML;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-ph");
      if (k) placeholderSnap[k] = el.placeholder;
    });
    document.querySelectorAll("[data-i18n-aria-key]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-aria-key");
      if (k) ariaSnap[k] = el.getAttribute("aria-label") || "";
    });
  }

  function setSvgOrHtml(el, str) {
    if (!el) return;
    var ns = el.namespaceURI;
    var tag = el.tagName && el.tagName.toLowerCase();
    if (ns === "http://www.w3.org/2000/svg" && (tag === "text" || tag === "title" || tag === "desc")) {
      var t = document.createElement("div");
      t.innerHTML = str;
      el.textContent = t.textContent;
      return;
    }
    el.innerHTML = str;
  }

  function applyLang(lang) {
    current = lang === "zh" ? "zh" : "en";
    try { localStorage.setItem(STORAGE_KEY, current); } catch (e) {}
    document.documentElement.lang = current === "zh" ? "zh-Hans" : "en";
    document.body.classList.toggle("lang-zh", current === "zh");
    document.title = current === "zh" ? ZH["doc.title"] : (snapshots["doc.title"] || document.title);
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (!k) return;
      if (current === "zh" && ZH[k]) setSvgOrHtml(el, ZH[k]);
      else if (snapshots[k] != null) setSvgOrHtml(el, snapshots[k]);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-ph");
      if (!k) return;
      el.placeholder = current === "zh" && ZH[k] ? ZH[k] : (placeholderSnap[k] != null ? placeholderSnap[k] : el.placeholder);
    });
    document.querySelectorAll("[data-i18n-aria-key]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-aria-key");
      if (!k) return;
      var v = current === "zh" && ZH[k] ? ZH[k] : (ariaSnap[k] != null ? ariaSnap[k] : el.getAttribute("aria-label"));
      if (v) el.setAttribute("aria-label", v);
    });
    var sel = document.getElementById("owlpoLangSelect");
    if (sel && sel.value !== current) sel.value = current;
    global.dispatchEvent(new CustomEvent("owlpo:lang", { detail: { lang: current } }));
  }

  function init() {
    if (!document.getElementById("owlpoLangSelect")) return;
    captureSnapshots();
    var t = document.querySelector("title");
    if (t && !snapshots["doc.title"]) snapshots["doc.title"] = document.title;
    var saved = "en";
    try { saved = localStorage.getItem(STORAGE_KEY) || "en"; } catch (e) {}
    applyLang(saved === "zh" ? "zh" : "en");
    var sel = document.getElementById("owlpoLangSelect");
    sel.addEventListener("change", function () { applyLang(sel.value); });
  }


  global.OWLPO_RESP_ZH = {"discover-1": {"label": "今晚睡前", "data": {"pickTag": "OWLRY 今晚之选", "reason": "适合那种灰蒙蒙、细雨绵绵的傍晚，让你静静坐着回忆些什么。"}, "gate": {"prompt": "想要猫头鹰的完整书信——<em>今晚</em>这本书为何适合你？", "cta": "发送到我的邮箱"}}, "discover-2": {"label": "清晨，准备出发", "data": {"pickTag": "OWLRY 今晨之选", "reason": "适合阻力特别大的清晨——一声可以装进口袋的呐喊。"}, "gate": {"prompt": "获取 Pressfield 为这样的清晨写下的 <em>三段话</em>。", "cta": "发送到我的邮箱"}}, "discover-3": {"label": "慵懒的周日下午", "data": {"pickTag": "OWLRY 午后之选", "reason": "适合想慢下来、带点欧陆气息的下午——一间酒店、一位伯爵、几十年的光阴。"}, "gate": {"prompt": "想把 <em>开篇几页</em> 寄给你——好让周日决定要不要这本书？", "cta": "发送到我的邮箱"}}, "ask-1": {"label": "我怎样才能停止过度思考？", "data": {"pickTag": "带着答案的那本书", "reason": "辛格与头脑里的声音共处了几十年，这本书是他的田野笔记。"}, "gate": {"prompt": "阅读 <em>完整段落</em>，外加一段专为你这个问题挑的摘录。", "cta": "发送到我的邮箱"}}, "ask-2": {"label": "要不要离开稳定工作去追一件事？", "data": {"pickTag": "带着答案的那本书", "reason": "米勒德 31 岁离开麦肯锡。关于「默认路径」的那一章，常让读者停下来给朋友写信。"}, "gate": {"prompt": "获取 <em>第三章全文</em>——打破魔咒的那一章。", "cta": "发送到我的邮箱"}}, "ask-3": {"label": "为什么我总是爱上同一类人？", "data": {"pickTag": "带着答案的那本书", "reason": "三种依附风格。一面不太舒服的镜子。你一再重复的模式，在这本书里有名字。"}, "gate": {"prompt": "做书中的 <em>十题测验</em>——看看哪种风格像你。", "cta": "发送到我的邮箱"}}, "skip-1": {"label": "《原子习惯》——给总是重新开始的人", "data": {"pickTag": "OWLRY 章节预览"}, "gate": {"prompt": "解锁 <em>完整个性化预览</em>——三章，写给总是重新开始的人。", "cta": "发送到我的邮箱"}}, "skip-2": {"label": "《金钱心理学》——给大学生", "data": {"pickTag": "OWLRY 章节预览"}, "gate": {"prompt": "解锁 <em>完整个性化预览</em>——三章，写给刚起步的人。", "cta": "发送到我的邮箱"}}, "skip-3": {"label": "《人类简史》——给早期创业者", "data": {"pickTag": "OWLRY 章节预览"}, "gate": {"prompt": "解锁 <em>完整个性化预览</em>——三章，写给早期创业者。", "cta": "发送到我的邮箱"}}};

  global.OWLPO_DEMO_INITIAL_ZH = {
    discover: '<div class="owl-prompt"><div class="owl-avatar" aria-hidden="true"><img class="owl-img" src="avatars/owl_avatar_default_64.png" alt="" width="64" height="64" decoding="async"></div><div class="owl-bubble">\u544a\u8bc9\u6211\u4f60\u73b0\u5728\u5728\u54ea\u91cc <span class="sparkle">\u2726</span> \u2014\u2014 \u6211\u4f1a\u627e\u5230\u4e3a\u8fd9\u4e00\u523b\u800c\u751f\u7684\u4e66\u3002</div></div><div class="chips-container" data-chips><button class="chip" type="button" data-response="discover-1"><span class="chip-icon">\ud83c\udf19</span>\u4eca\u665a\u7761\u524d</button><button class="chip" type="button" data-response="discover-2"><span class="chip-icon">\u2600</span>\u6e05\u6668\uff0c\u51c6\u5907\u51fa\u53d1</button><button class="chip" type="button" data-response="discover-3"><span class="chip-icon">\ud83c\udf43</span>\u6175\u61d2\u7684\u5468\u65e5\u4e0b\u5348</button></div>',
    ask: '<div class="owl-prompt"><div class="owl-avatar" aria-hidden="true"><img class="owl-img" src="avatars/owl_avatar_default_64.png" alt="" width="64" height="64" decoding="async"></div><div class="owl-bubble">\u662f\u4ec0\u4e48\u95ee\u9898\u8ba9\u4f60\u7761\u4e0d\u7740 <span class="sparkle">\u2726</span> \u2014\u2014 \u6211\u4f1a\u627e\u5230\u5e26\u7740\u7b54\u6848\u7684\u90a3\u672c\u4e66\u3002</div></div><div class="chips-container" data-chips><button class="chip" type="button" data-response="ask-1"><span class="chip-icon">\u26a1</span>\u6211\u600e\u6837\u624d\u80fd\u505c\u6b62\u8fc7\u5ea6\u601d\u8003\uff1f</button><button class="chip" type="button" data-response="ask-2"><span class="chip-icon">\ud83d\udeaa</span>\u8981\u4e0d\u8981\u79bb\u5f00\u7a33\u5b9a\u5de5\u4f5c\u53bb\u8ffd\u4e00\u4ef6\u4e8b\uff1f</button><button class="chip" type="button" data-response="ask-3"><span class="chip-icon">\ud83d\udc94</span>\u4e3a\u4ec0\u4e48\u6211\u603b\u662f\u7231\u4e0a\u540c\u4e00\u7c7b\u4eba\uff1f</button></div>',
    skip: '<div class="owl-prompt"><div class="owl-avatar" aria-hidden="true"><img class="owl-img" src="avatars/owl_avatar_default_64.png" alt="" width="64" height="64" decoding="async"></div><div class="owl-bubble">\u9009\u4e00\u672c\u4e66\uff0c\u544a\u8bc9\u6211\u4f60\u7684\u89d2\u5ea6 <span class="sparkle">\u2726</span> \u2014\u2014 \u6211\u4f1a\u62bd\u51fa\u771f\u6b63\u91cd\u8981\u7684\u7ae0\u8282\u3002</div></div><div class="chips-container" data-chips><button class="chip" type="button" data-response="skip-1"><span class="chip-icon">\ud83d\udcd5</span>\u300a\u539f\u5b50\u4e60\u60ef\u300b\u2014\u2014\u7ed9\u603b\u662f\u91cd\u65b0\u5f00\u59cb\u7684\u4eba</button><button class="chip" type="button" data-response="skip-2"><span class="chip-icon">\ud83d\udcd7</span>\u300a\u91d1\u94b1\u5fc3\u7406\u5b66\u300b\u2014\u2014\u7ed9\u5927\u5b66\u751f</button><button class="chip" type="button" data-response="skip-3"><span class="chip-icon">\ud83d\udcd9</span>\u300a\u4eba\u7c7b\u7b80\u53f2\u300b\u2014\u2014\u7ed9\u65e9\u671f\u521b\u4e1a\u8005</button></div>'
  };

  global.OwlpoLang = {
    init: init,
    apply: applyLang,
    get: function () { return current; },
    t: function (key) { return current === "zh" && ZH[key] ? ZH[key] : (snapshots[key] != null ? snapshots[key] : ""); },
    messages: ZH
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : this);