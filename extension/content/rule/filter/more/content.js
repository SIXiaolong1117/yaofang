; (function () {

  const yawf = window.yawf;
  const util = yawf.util;
  const rule = yawf.rule;
  const observer = yawf.observer;
  const init = yawf.init;

  const more = yawf.rules.more;

  const feedParser = yawf.feed;

  const i18n = util.i18n;
  i18n.moreContentGroupTitle = {
    cn: '隐藏以下微博 - 特定内容',
    tw: '隱藏以下內容 - 某些内容',
    en: 'Hide following content - Certain Content',
  };

  const content = more.content = {};
  content.content = rule.Group({
    parent: more.more,
    template: () => i18n.moreContentGroupTitle,
  });

  i18n.deletedForwardFilter = {
    cn: '已删除或无法查看的微博的转发{{i}}',
    tw: '已刪除或無法查看的微博的轉發{{i}}',
    en: 'Forward of deleted / inaccessible Weibo{{i}}',
  };
  i18n.deletedForwardFilterDetail = {
    cn: '包括因为删除或对微博设置了隐私权限而使您无法看到原文的微博。这些微博您只能看见转发者的评论，但是无法看到原微博的内容。',
  };

  content.deletedForward = rule.Rule({
    weiboVersion: [6, 7],
    id: 'filter_deleted_forward',
    version: 1,
    parent: content.content,
    template: () => i18n.deletedForwardFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.deletedForwardFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function deletedForwardFilter(feed) {
        if (!rule.isEnabled()) return null;
        const isForward = feedParser.isForward(feed);
        if (!isForward) return null;
        if (yawf.WEIBO_VERSION === 6) {
          const forwardContent = feed.querySelector('.WB_media_expand .WB_info .WB_name, .WB_expand .WB_info .W_fb');
          if (forwardContent) return null;
          return 'hide';
        } else {
          if (feed.retweeted_status) {
            if ((feed.retweeted_status.visible || {}).list_id > 0) return 'hide';
            if (feed.retweeted_status.deleted) return 'hide';
          }
          return null;
        }
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.commentAndForwardFilter = {
    cn: '回复并转发的微博{{i}}',
    tw: '回覆並轉發的微博{{i}}',
    en: 'Weibo forwarded as reply{{i}}',
  };
  i18n.commentAndForwardFilterDetail = {
    cn: '在回复他人微博时选择“同时转发到我的微博”会将回复和被回复的内容转发为一条微博，勾选后会隐藏回复时转发的微博。',
  };

  content.commentAndForward = rule.Rule({
    id: 'filter_comment_and_forward',
    version: 1,
    parent: content.content,
    template: () => i18n.commentAndForwardFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.commentAndForwardFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function commentAndForwardFilter(feed) {
        if (!rule.isEnabled()) return null;
        const replyText = ['回复', '回復', '回覆', 'Reply', 'reply'];
        if (!feedParser.isForward(feed)) return null;
        const content = feed.querySelector('[node-type="feed_list_content"]'); if (!content) return null;
        if (!content.firstChild || !replyText.includes(content.firstChild.textContent.trim())) return null;
        if (!content.childNodes[1] || !content.childNodes[1].getAttribute('usercard')) return null;
        return 'hide';
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.voteFeedFilter = {
    cn: '投票微博{{i}}',
    tw: '投票微博{{i}}',
    en: 'Voting weibo{{i}}',
  };
  i18n.voteFeedFilterDetail = {
    cn: '包括在发布微博时选择投票的微博，也包括在投票时自动发出的微博。',
  };

  content.vote = rule.Rule({
    weiboVersion: [6, 7],
    id: 'filter_vote',
    version: 1,
    parent: content.content,
    template: () => i18n.voteFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.voteFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function voteFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (yawf.WEIBO_VERSION === 6) {
          if (feed.querySelector('.WB_from a[href*="//vote.weibo.com/"]')) return 'hide';
          if (feed.querySelector('.WB_feed_spec_cont a[action-data*="vote.weibo.com"]')) return 'hide';
          if (feed.querySelector('a[suda-uatrack*="1022-vote"]')) return 'hide';
          if (feed.querySelector('a[suda-uatrack*="1022-hudongvote"]')) return 'hide';
          if (feed.querySelector('.icon_sw_vote')) return 'hide';
          if (feedParser.source.text(feed).includes('投票')) return 'hide';
        } else {
          if (Array.isArray(feed.url_struct)) {
            if (feed.url_struct.find(url => /^1022:231716/.test((url.actionlog || {}).oid))) return 'hide';
            if (feed.url_struct.find(url => /https:\/\/vote\.weibo\.com\//.test(url.long_url))) return 'hide';
            if (feed.url_struct.find(url => /https:\/\/vote\.weibo\.com\//.test(url.ori_url))) return 'hide';
            if (feed.url_struct.find(url => /sinaweibo:\/\/browser\?url=https%3A%2F%2Fvote\.weibo\.com%2F/.test(url.ori_url))) return 'hide';
          }
          if ((feed.page_info || {}).object_type === 'hudongvote') return 'hide';
        }
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.redPackFeedFilter = {
    cn: '抢红包微博{{i}}',
    tw: '搶紅包微博{{i}}',
    en: 'Weibo with Red Envelopes Rush {{i}}',
  };
  i18n.redPackFeedFilterDetail = {
    cn: '抢红包活动自动发布的微博',
  };

  content.redPack = rule.Rule({
    id: 'filter_red_pack',
    version: 1,
    parent: content.content,
    template: () => i18n.redPackFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.redPackFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function redPackFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (feed.querySelector('.PCD_event_red2014')) return 'hide';
        if (feed.querySelector('.WB_feed_spec_red2015')) return 'hide';
        if (feed.querySelector('.WB_feed_spec_red16')) return 'hide';
        if (feed.querySelector('.media-redpacket')) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.imageTagFeedFilter = {
    cn: '配图带有标签的微博{{i}}',
    tw: '配圖帶有標記的微博{{i}}',
    en: 'Feeds with tags on images {{i}}',
  };
  i18n.imageTagFeedFilterDetail = {
    cn: '微博允许给配图添加标签，标签可以是文本、话题、用户以及商品链接。选择这条规则后将不会看到对应的微博，另外您可以只隐藏[[clean_feed_pic_tag]]。',
  };
  content.imageTag = rule.Rule({
    weiboVersion: [6, 7], // 虽然 V7 网页目前还不支持查看标签，不过我只管有没有，不管看得见看不见
    id: 'filter_image_tag',
    version: 47,
    parent: content.content,
    template: () => i18n.imageTagFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.imageTagFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function imageTagFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (yawf.WEIBO_VERSION === 6) {
          const list = feed.querySelector('.WB_media_a[action-data*="photo_tag_pids"]');
          if (!list) return null;
          const tagPidsStr = new URLSearchParams(list.getAttribute('action-data')).get('photo_tag_pids');
          if (!tagPidsStr) return null;
          const tagPids = tagPidsStr.split(',');
          const items = feed.querySelectorAll('[action-type="fl_pics"][action-data*="pic_id"]');
          const hasTag = Array.from(items).some(item => {
            const id = new URLSearchParams(item.getAttribute('action-data')).get('pic_id');
            return tagPids.includes(id);
          });
          if (!hasTag) return null;
          return 'hide';
        } else {
          const pics = feedParser.pics.info(feed);
          if (pics.find(pic => (pic.pic_tags || []).length)) return 'hide';
          return null;
        }
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.koiForwardFeedFilter = {
    cn: '转发图标是锦鲤的微博（转发抽奖微博）',
    tw: '轉發圖示是錦鯉的微博（轉發抽獎微博）',
    en: 'Forward icon as a koi (forward this weibo for draw)',
  };
  i18n.koiForwardFeedFilterDetail = {
    cn: '微博会将转发抽奖的消息的转发按钮显示成一条鱼的图标。这项规则会根据这个图标作为判断依据隐藏对应的微博。',
  };

  content.koiForward = rule.Rule({
    id: 'filter_koi_forward',
    version: 1,
    parent: content.content,
    template: () => i18n.koiForwardFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.koiForwardFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function koiForwardFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (feed.querySelector('a[action-type="fl_forward"] .icon_jinli')) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.appItemFeedFilter = {
    cn: '介绍微博应用的微博{{i}}',
    tw: '介紹微博應用的微博{{i}}',
    en: 'Weibo with app item {{i}}',
  };
  i18n.appItemFeedFilterDetail = {
    cn: '介绍微博应用的微博，包括含有微博应用的链接或含有微博应用的卡片的情况。微博应用的链接会以应用图标标记。勾选此项以隐藏此类微博。',
  };

  content.appItem = rule.Rule({
    id: 'filter_app_item',
    version: 1,
    parent: content.content,
    template: () => i18n.appItemFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.appItemFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function appItemFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (feed.querySelector('.WB_feed_spec[exp-data*="key=tblog_weibocard"][exp-data*="1042005-appItem"]')) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.wendaFeedFilter = {
    cn: '微博问答相关的提问、回答或围观{{i}}',
    tw: '微博問答相關的提問、回答或圍觀{{i}}',
    en: 'Weibo asking, answering, or viewing Weibo Q and A {{i}}',
  };
  i18n.wendaFeedFilterDetail = {
    cn: '微博问答功能的提问、回答或围观都会发布一条新微博，如果您不希望看到相关微博，您可以勾选此选项以隐藏相关微博。',
  };

  content.wenda = rule.Rule({
    id: 'filter_wenda',
    version: 1,
    parent: content.content,
    template: () => i18n.wendaFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.wendaFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function wendaFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        // 这条规则不在显示某人的全部问答页面生效，避免显示空页面
        if (feed.matches('[id^="Pl_Core_WendaList__"] *')) return null;
        if (feed.querySelector('[suda-uatrack*="1022-wenda"]')) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.wenwoDrFeedFilter = {
    cn: '含有爱问医生健康科普文章的微博{{i}}',
    tw: '含有愛問醫生健康科普文章的微博{{i}}',
    en: 'Weibo with 爱问医生 (iask medical) article {{i}}',
  };
  i18n.wenwoDrFeedFilterDetail = {
    cn: '爱问医生健康科普文章是一些来自 wenwo.com 的健康、医疗相关文章。打开爱问医生健康科普文章的网站时，您可能会自动关注文章作者或相应帐号。开启以隐藏包含此类文章的微博。',
  };

  content.wenwoDr = rule.Rule({
    id: 'filter_wenwo_dr',
    version: 1,
    parent: content.content,
    template: () => i18n.wenwoDrFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.wenwoDrFeedFilter },
    },
    init() {
      const rule = this;
      observer.feed.filter(function wenwoDrFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (feed.querySelector('div[action-data*="objectid=2017896001:"]')) return 'hide';
        if (feed.querySelector('a[suda-uatrack*="2017896001-product"]')) return 'hide';
        if (feed.querySelector('[exp-data*="2243615001-product"]')) return 'hide';
        if (feed.querySelector('a[href*="//dr.wenwo.com/"]')) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.yizhiboFeedFilter = {
    cn: '含有“一直播”视频直播的微博|{{type}}',
    tw: '含有「一直播」直播影片的微博|{{type}}',
    en: 'Weibo with live video on yizhibo | {{type}}',
  };
  i18n.yizhiboFeedFilterAll = {
    cn: '隐藏正在直播或已结束回放',
    tw: '隱藏正在直播或已結束回放',
    en: 'hide live and replay',
  };
  i18n.yizhiboFeedFilterReplay = {
    cn: '仅隐藏已结束回放',
    tw: '僅隱藏已結束回放',
    en: 'hide replay only',
  };

  content.yizhibo = rule.Rule({
    id: 'filter_yizhibo',
    version: 1,
    parent: content.content,
    template: () => i18n.yizhiboFeedFilter,
    ref: {
      type: {
        type: 'select',
        select: [
          { value: 'all', text: () => i18n.yizhiboFeedFilterAll },
          { value: 'replay', text: () => i18n.yizhiboFeedFilterReplay },
        ],
      },
    },
    init() {
      const rule = this;
      observer.feed.filter(function yizhiboFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        const type = rule.ref.type.getConfig();
        const live = feed.querySelector('.WB_video[action-data*="type=feedlive"]');
        if (!live) return null;
        if (type === 'all') return 'hide';
        if (live.matches('[action-data*="is_replay=1"]')) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.paidFeedFilter = {
    cn: '需要付费查看的微博{{i}}',
    tw: '需要付費查看的微博{{i}}',
    en: 'FeedFilter require paid to view {{i}}',
  };
  i18n.paidFeedFilterDetail = {
    cn: '博主在发布微博时，可以选择指定内容需要付费才能查看。在您向单条内容或博主付费后，才可查看相关内容。所付费用除博主的收益外，还可能包含部分渠道商分成和税金。',
  };

  content.paid = rule.Rule({
    weiboVersion: [6, 7],
    id: 'filter_paid',
    version: 1,
    parent: content.content,
    template: () => i18n.paidFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.paidFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function paidFeedFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (yawf.WEIBO_VERSION === 6) {
          const searchParams = new URLSearchParams(location.search);
          const paidOnly = +searchParams.get('vplus') || searchParams.get('is_vclub');
          if (paidOnly) return null;
          if (feed.querySelector('.icon_vplus')) return 'hide';
          if (feed.querySelector('.WB_media_a[action-data*="isPrivate=1"]')) return 'hide';
          if (feed.querySelector('[action-type="fl_pics"][action-data*="isPrivate=1"]')) return 'hide';
        } else {
          const pics = feedParser.pics.info(feed);
          // 付费图片
          if (pics.find(pic => (pic.blur || {}).isPay)) return 'hide';
          // 付费文章的特征找不到！
        }
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.multipleTopicsFeedFilter = {
    cn: '正文中提到|至少{{num}}个话题的微博{{i}}',
    tw: '正文中提到|至少{{num}}個話題的微博{{i}}',
    en: 'Feeds with | at least {{num}} topics in its content {{i}}',
  };
  i18n.multipleTopicsFeedFilterDetails = {
    cn: '由于微博热门话题搜索、话题主持人等功能会增加带有某些话题的微博的曝光量。所以存在一些通过罗列若干热门话题来增加广告内容曝光量的微博。您可以隐藏一次性提到了太多话题的微博以免看到他们。',
  };

  content.multipleTopics = rule.Rule({
    id: 'filter_multiple_topics_feed',
    version: 1,
    parent: content.content,
    template: () => i18n.multipleTopicsFeedFilter,
    ref: {
      num: { type: 'range', min: 3, max: 10, initial: 5 },
      i: { type: 'bubble', icon: 'ask', template: () => i18n.multipleTopicsFeedFilterDetails },
    },
    init() {
      const rule = this;
      observer.feed.filter(function multipleTopicsFilter(feed) {
        if (!rule.isEnabled()) return null;
        const limit = rule.ref.num.getConfig();
        const topics = feedParser.topic.dom(feed);
        if (topics.length >= limit) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

  i18n.fastForwardFeedFilter = {
    cn: '使用快转转发的微博',
    tw: '使用快轉轉發的微博',
    en: 'Fast forwarded feeds',
  };
  i18n.fastForwardFeedFilterDetail = {
    cn: '使用快转转发微博时，转发得到的微博的评论和转发不可用，展示时仅显示被转发的那条微博并标注“被××快转了”。任何针对该微博的评论实际上是针对被转发的微博的评论。',
  };

  content.fastForward = rule.Rule({
    weiboVersion: [6, 7],
    id: 'filter_fast_forward',
    version: 67,
    parent: content.content,
    template: () => i18n.fastForwardFeedFilter,
    ref: {
      i: { type: 'bubble', icon: 'ask', template: () => i18n.fastForwardFeedFilterDetail },
    },
    init() {
      const rule = this;
      observer.feed.filter(function fastForwardFilter(feed) {
        if (!rule.isEnabled()) return null;
        if (feedParser.isFastForward(feed)) return 'hide';
        return null;
      });
      this.addConfigListener(() => { observer.feed.rerun(); });
    },
  });

}());
