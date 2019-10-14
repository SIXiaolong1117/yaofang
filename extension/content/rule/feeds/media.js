; (function () {

  const yawf = window.yawf;
  const env = yawf.env;
  const util = yawf.util;
  const rule = yawf.rule;
  const observer = yawf.observer;
  const request = yawf.request;
  const download = yawf.download;
  const contextmenu = yawf.contextmenu;
  const imageViewer = yawf.imageViewer;
  const feedParser = yawf.feed;

  const feeds = yawf.rules.feeds;

  const i18n = util.i18n;
  const css = util.css;
  const urls = util.urls;

  const media = feeds.media = {};

  i18n.feedMediaGroupTitle = {
    cn: '图片与视频',
    tw: '圖片與視頻',
    en: 'Images &amp; Videos',
  };

  media.media = rule.Group({
    parent: feeds.feeds,
    template: () => i18n.feedMediaGroupTitle,
  });

  Object.assign(i18n, {
    viewOriginal: env.config.contextMenuSupported ? {
      cn: '查看图片添加“查看原图”链接|打开{{open}}||{{direct}}点击缩略图时直接查看原图||{{contextmenu}}添加到右键菜单',
      tw: '查看圖片添加「查看原圖」連結|打開{{open}}||{{direct}}點擊縮圖時直接查看原圖||{{contextmenu}}添加到操作功能表',
      en: 'add "Original Picture" link for images | which targeted to {{open}} || {{direct}} View original pictures by clicking on thumbnail || {{contexmenu}} Add to context menu',
    } : {
      cn: '查看图片添加“查看原图”链接|打开{{open}}||{{direct}}点击缩略图时直接查看原图',
      tw: '查看圖片添加「查看原圖」連結|打開{{open}}||{{direct}}點擊縮圖時直接查看原圖',
      en: 'add "Original Picture" link for images | which targeted to {{open}} || {{direct}} View original pictures by clicking on thumbnail',
    },
    viewOriginalPage: { cn: '包含原图的网页', tw: '包含原圖的網頁', en: 'page with original picture' },
    viewOriginalImage: { cn: '原图', tw: '原圖', en: 'original picture' },
    viewOriginalText: { cn: '查看原图', tw: '查看原圖', en: 'Original Picture' },
  });

  const getImageUrl = function (img, large) {
    const src = img.getAttribute('yawf-ori-src') || img.getAttribute('ori-src') || img.src;
    if (!large) return src;
    const url = ['https://', new URL(src).host, '/large', src.match(/\/([^/]*)$/g)].join('');
    return url;
  };

  const getImagesInfo = function (ref) {
    let container, imgs, img;
    if (ref.matches('.WB_detail .WB_expand_media *')) {
      // 已经展开详情的图片
      container = ref.closest('.WB_detail');
      imgs = Array.from(container.querySelectorAll('.WB_media_wrap .WB_pic img'));
      img = container.querySelector('.media_show_box img') ||
        container.querySelector('.current img');
      if (ref.matches('[action-type="widget_photoview"]')) {
        img = document.createElement('image');
        img.src = 'https://wx1.sinaimg.cn/large/' + new URLSearchParams(ref.getAttribute('action-data')).get('pid') + '.jpg';
      }
      // fallthrough
    } else if (ref.matches('.WB_expand_media .tab_feed_a *')) {
      // 已经展开详情的评论配图
      container = ref.closest('.WB_expand_media');
      img = container.querySelector('.artwork_box img');
      imgs = [img];
      // fallthrough
    } else if (ref.matches('.WB_media_wrap .WB_pic')) {
      // 没有展开详情的图片
      container = ref.closest('.WB_media_wrap');
      imgs = Array.from(container.querySelectorAll('.WB_pic img'));
      img = ref.querySelector('img');
      // fallthrough
    } else if (ref.getAttribute('imagecard')) {
      const pid = new URLSearchParams(ref.getAttribute('imagecard')).get('pid');
      return { images: ['https://wx1.sinaimg.cn/large/' + pid + '.jpg'], current: 1 };
    } else if (ref.href && ref.href.indexOf('javascript:') === -1) {
      return { images: [ref.href], current: 1 };
    } else if (ref instanceof HTMLImageElement && ref.src) {
      return { images: [getImageUrl(ref, true)], current: 1 };
    } else return null;
    const images = imgs.map(img => getImageUrl(img, true));
    const pid = img && getImageUrl(img).match(/[^/.]*(?=(?:\.[^/.]*)?$)/)[0];
    const current = images.findIndex(image => image.includes(pid)) + 1;
    return { images, current };
  };

  media.viewOriginal = rule.Rule({
    id: 'feed_view_original',
    version: 1,
    parent: media.media,
    template: () => i18n.viewOriginal,
    ref: {
      open: {
        type: 'select',
        initial: 'page',
        select: [
          { value: 'page', text: () => i18n.viewOriginalPage },
          { value: 'image', text: () => i18n.viewOriginalImage },
        ],
      },
      direct: { type: 'boolean' },
      contextmenu: { type: 'boolean', initial: true },
    },
    init() {
      this.ref.direct.addConfigListener(newValue => {
        if (newValue) media.downloadImage.ref.direct.setConfig(false);
      });

      const viewEnabled = this.isEnabled();
      const viewType = this.ref.open.getConfig();
      const directView = viewEnabled && this.ref.direct.getConfig();
      const contextMenuView = viewEnabled && this.ref.contextmenu.getConfig();

      const downloadImage = media.downloadImage;
      const downloadEnabled = downloadImage.isEnabled();
      const downloadName = downloadImage.ref.name.getConfig();
      const directDownload = downloadEnabled && downloadImage.ref.direct.getConfig();
      const contextMenuDownload = downloadEnabled && downloadImage.ref.contextmenu.getConfig();

      if (!viewEnabled && !downloadEnabled) return;

      // 查看原图
      const showOriginalPage = function ({ images, current }) {
        if (viewType !== 'image') {
          imageViewer.open({ images, current });
        } else {
          window.open(images[current - 1]);
        }
      };

      const viewOriginalButton = viewLargeLink => {
        const viewOriginalLinkContainer = document.createElement('ul');
        viewOriginalLinkContainer.innerHTML = '<li><span class="line S_line1"><a class="S_txt1" href="javascript:;" target="_blank"><i class="W_ficon ficon_search S_ficon">l</i></a></span></li>';
        viewOriginalLinkContainer.querySelector('i').after(i18n.viewOriginalText);
        const viewOriginalLink = viewOriginalLinkContainer.querySelector('a');
        let images, current;
        const update = function () {
          ({ images, current } = getImagesInfo(viewLargeLink));
          viewOriginalLink.href = images[current - 1];
        };
        viewOriginalLink.addEventListener('click', event => {
          if (viewType === 'page') {
            showOriginalPage({ images, current });
            event.preventDefault();
          }
        });
        (new MutationObserver(update)).observe(viewLargeLink, { attributes: true });
        update();
        return viewOriginalLinkContainer.firstChild;
      };

      // 下载图片
      const downloadImages = function (images, ref) {
        const files = images.map((url, index) => {
          const oriFilename = url.slice(url.lastIndexOf('/') + 1);
          let filename = oriFilename;
          if (downloadName !== 'original') {
            const extension = oriFilename.slice(oriFilename.lastIndexOf('.') + 1);
            filename = (index + 1) + '.' + extension;
          }
          const feed = ref.closest('[mid], [omid], [comment_id]');
          const feedId = feed.getAttribute('comment_id') ||
            ref.closest('.WB_feed_expand') && feed.getAttribute('omid') ||
            feed.getAttribute('mid') || 0;
          const path = 'weibo-images/' + download.filename(feedId) + '/' + filename;
          return { url, filename: path };
        });
        files.forEach(file => {
          util.debug('download fetch url %s', file.url);
        });
        download.urls(files);
      };

      const downloadButton = viewLargeLink => {
        const downloadLinkContainer = document.createElement('ul');
        downloadLinkContainer.innerHTML = '<li><span class="line S_line1"><a class="S_txt1" href="javascript:;" target="_blank"><i class="W_ficon ficon_search S_ficon">|</i></a></span></li>';
        downloadLinkContainer.querySelector('i').after(i18n.downloadImageText);
        const downloadLink = downloadLinkContainer.querySelector('a');
        downloadLink.addEventListener('click', event => {
          const { images } = getImagesInfo(viewLargeLink);
          downloadImages(images, downloadLink);
          event.preventDefault();
        });
        return downloadLinkContainer.firstChild;
      };

      // 检查展开的图片，添加查看原图和下载的链接
      const addImageHandlerLink = function addImageHandlerLink() {
        const viewLargeLinks = Array.from(document.querySelectorAll([
          // 微博配图
          '.WB_feed li a[action-type="widget_photoview"]:not([yawf-view-ori])',
          // 评论配图
          '.WB_feed li a[action-type="widget_commentPhotoView"]:not([yawf-view-ori])',
        ].join(',')));
        viewLargeLinks.forEach(viewLargeLink => {
          viewLargeLink.setAttribute('yawf-view-ori', '');
          const li = viewLargeLink.closest('li');
          if (downloadEnabled) {
            li.after(downloadButton(viewLargeLink));
          }
          if (viewEnabled) {
            li.after(viewOriginalButton(viewLargeLink));
          }
        });
      };
      observer.dom.add(addImageHandlerLink);

      // 处理点击时直接查看原图/下载的情况
      if (directView || directDownload) {
        document.addEventListener('click', function (event) {
          const target = event.target;
          if (event.button !== 0) return; // 只响应左键操作
          if (event.shiftKey) return; // 按下 Shift 时不响应
          if (target.closest('.yawf-WB_pic_more')) return; // 展开过多被折叠的图片
          const pic = target.closest('.WB_media_wrap .WB_pic') || target.closest('a[imagecard]');
          if (!pic) return;
          event.stopPropagation();
          const { images, current } = getImagesInfo(pic);
          if (directView) showOriginalPage({ images, current });
          else downloadImages(images, target);
        }, true);
      }

      if (env.config.contextMenuSupported && (contextMenuView || contextMenuDownload)) {
        contextmenu.addListener(function (/** @type {MouseEvent} */event) {
          /** @type {Element & EventTarget} */
          const target = event.target;
          const pic = (function () {
            const pic = target.closest('.WB_media_wrap .WB_pic') || target.closest('a[imagecard]');
            if (pic) return pic;
            const feed = target.closest('.WB_feed_type');
            if (!feed) return null;
            const feedPic = feed.querySelector('.WB_media_wrap .WB_pic');
            return feedPic;
          }());
          if (!pic || !pic.contains(target)) return [];
          const { images, current } = getImagesInfo(pic);
          const result = [];
          if (contextMenuView) {
            result.push({
              title: i18n.viewOriginalText,
              onclick: () => { showOriginalPage({ images, current }); },
            });
          }
          if (contextMenuDownload) {
            result.push({
              title: i18n.downloadImageText,
              onclick: () => { downloadImages({ images, current }); },
            });
          }
          return result;
        });
      }
    },
  });

  Object.assign(i18n, {
    downloadImage: env.config.contextMenuSupported ? {
      cn: '查看图片添加“批量下载”链接|使用{{name}}文件名保存||{{direct}}点击缩略图时直接开始下载||{{contextmenu}}添加到右键菜单',
      tw: '查看圖片添加「批次下載」連結|使用{{name}}檔名儲存||{{direct}}點擊縮圖時直接開始下載||{{contextmenu}}添加到操作功能表',
      en: 'Add "Batch Download" link for images {{name}}|Use {{name}} filenames || {{direct}} Trigger download by clicking on thumbnail||{{contextmenu}} Add to context menu',
    } : {
      cn: '查看图片添加“批量下载”链接|使用{{name}}文件名保存||{{direct}}点击缩略图时直接开始下载',
      tw: '查看圖片添加「批次下載」連結|使用{{name}}檔名儲存||{{direct}}點擊縮圖時直接開始下載表',
      en: 'Add "Batch Download" link for images {{name}}|Use {{name}} filenames || {{direct}} Trigger download by clicking on thumbnail',
    },
    downloadImageNameOriginal: {
      cn: '原始',
      en: 'original',
    },
    downloadImageNameIndex: {
      cn: '序号',
      tw: '序號',
      en: 'index',
    },
    downloadImageText: {
      cn: '批量下载',
      tw: '批次下載',
      en: 'Batch Download',
    },
  });

  media.downloadImage = rule.Rule({
    id: 'feed_download_image',
    version: 1,
    parent: media.media,
    template: () => i18n.downloadImage,
    ref: {
      name: {
        type: 'select',
        select: [
          { value: 'index', text: () => i18n.downloadImageNameIndex },
          { value: 'original', text: () => i18n.downloadImageNameOriginal },
        ],
      },
      direct: { type: 'boolean' },
      contextmenu: { type: 'boolean', initial: true },
    },
    init() {
      this.ref.direct.addConfigListener(newValue => {
        if (newValue) media.viewOriginal.ref.direct.setConfig(false);
      });
      // 实现在查看原图功能那里
    },
  });

  Object.assign(i18n, {
    allImagesAvailable: { cn: '支持查看超过 9 张的配图{{i}}', tw: '支援查閱超過 9 張的配圖{{i}}', en: 'Support feeds with more than 9 images {{i}}' },
    allImagesAvailableDetail: { cn: '由于目前网页的支持情况，脚本需要为每个有 9 张或更多图片的微博发送请求检查是否有更多的图片。' },
    animatedImage: { cn: '动图' },
    previewAllShow: { cn: '查看全部图片（共 {1} 张）', tw: '閱覽全部圖片（共 {1} 張）', en: 'View all ({1} images)' },
    previewAllFold: { cn: '折叠图片', tw: '折疊圖片', en: 'Fold images' },
  });

  // TODO 等微博官方支持了查看全图之后这段大概要重写
  media.allImagesAvailable = rule.Rule({
    id: 'all_image_available',
    version: 48,
    parent: media.media,
    template: () => i18n.allImagesAvailable,
    ref: {
      i: { type: 'bubble', icon: 'warn', template: () => i18n.allImagesAvailableDetail },
    },
    init() {
      this.addConfigListener(config => {
        if (!config) media.imagePreviewAll.setConfig(false);
      });
    },
    ainit() {
      const previewSize = media.imagePreviewAll.isEnabled() ? media.imagePreviewAll.ref.count.getConfig() : '3x3';
      const previewWidth = +previewSize[0];
      const previewCount = previewSize[0] * previewSize[2] || Infinity;
      const lastImageMask = media.imagePreviewAll.isEnabled() ? media.imagePreviewAll.ref.more.getConfig() === 'mask' : false;

      observer.feed.onAfter(async function (/** @type {HTMLElement} */feed) {
        const ul = feed.querySelector('ul[node-type="fl_pic_list"]');
        if (!ul) return;
        const image9 = ul.querySelector('.li_9');
        if (!image9) return; // 有九张图就说明可能有更多
        const mid = (feedParser.isForward(feed) ? feedParser.omid : feedParser.mid)(feed);
        const [author] = feedParser.author.id(feed);
        /** @type {string[]} */
        const allImages = await request.getAllImages(mid);
        const imageCount = allImages.length;
        if (imageCount < 10) return;
        const pids = allImages.map(img => img.replace(/^.*\/(.*)\..*$/, '$1'));
        const imgType = type => img => img.replace(/^(.*\/).*(\/.*)$/, (_, d, n) => d + type + n);
        allImages.forEach((image, index) => {
          if (index < 9) return;
          const pid = pids[index];
          const li = document.createElement('li');
          li.className = `WB_pic li_${index + 1} S_bg1 S_line2 bigcursor li_focus yawf-li_more`;
          li.setAttribute('action-data', `isPrivate=0&relation=0&pic_id=${pid}`)
          li.setAttribute('action-type', 'fl_pics');
          li.setAttribute('suda-uatrack', `key=tblog_newimage_feed&value=image_feed_unfold:${mid}:${pid}:${author}:0`);
          const img = li.appendChild(document.createElement('img'));
          // 因为不知道总宽比的时候不太方便处理 orj360，所以用 thumb300 代替一下
          img.src = imgType('thumb300')(image);
          img.style = 'height:110px;width:110px;top:0;left:0;';
          ul.appendChild(li);
          if (image.endsWith('.gif')) {
            const tip = document.createElement('i');
            tip.className = 'W_icon_tag_v2';
            tip.textContent = i18n.animatedImage;
            li.appendChild(tip);
          }
        });
        // 同时保留 WB_media_a_m9
        ul.classList.add('WB_media_a_m' + imageCount, 'yawf-WB_media_a_more');
        // 不能用 URLSearchParams 来处理 actionData，因为它需要项目间的逗号不被转义才能正常工作
        const actionData = ul.getAttribute('action-data').split('&');
        const setActionData = (key, value) => {
          const newValue = key + '=' + value.map(encodeURIComponent).join(',');
          const item = actionData.findIndex(item => item.startsWith(key + '='));
          if (item !== -1) actionData[item] = newValue;
          else actionData.push(newValue);
        };
        setActionData('clear_picSrc', allImages.map(imgType('mw690')));
        setActionData('thumb_picSrc', allImages.map(imgType('orj360')));
        setActionData('pic_ids', pids);
        setActionData('object_ids', pids.map(pid => '1042018:' + pid));
        // GIF 对应的视频 id 拿不到，只能等微博自己支持
        ul.setAttribute('action-data', actionData.join('&'));

        if (imageCount > previewCount) {
          /** @type {HTMLDivElement} */
          const mediaWrap = ul.closest('.WB_media_wrap');
          if (lastImageMask) {
            const lastImage = ul.querySelectorAll('.WB_pic')[previewCount - 1];
            const mask = document.createElement('span');
            mask.className = 'yawf-WB_pic_more';
            mask.textContent = '+' + (imageCount - previewCount);
            lastImage.appendChild(mask);
          } else {
            // 类似超过 140 字的展开全文一样，我们显示一个查看所有图片的按钮
            const foldContainer = document.createElement('div');
            foldContainer.className = 'yawf-WB_media_a_ctrl yawf-WB_text_size';
            foldContainer.innerHTML = '<a href="javascript:;" class="yawf-WB_media_a_show"><i class="W_ficon ficon_arrow_down">c</i></a><a href="javascript:;" class="yawf-WB_media_a_fold"><i class="W_ficon ficon_arrow_up">d</i></a>';
            const showButton = foldContainer.querySelector('.yawf-WB_media_a_show');
            const showText = i18n.previewAllShow.replace('{1}', () => imageCount);
            showButton.insertBefore(document.createTextNode(showText), showButton.firstChild);
            const foldButton = foldContainer.querySelector('.yawf-WB_media_a_fold');
            const foldText = i18n.previewAllFold;
            foldButton.insertBefore(document.createTextNode(foldText), foldButton.firstChild);
            showButton.addEventListener('click', () => {
              mediaWrap.classList.add('yawf-WB_media_a_all');
            });
            foldButton.addEventListener('click', () => {
              const oldHeight = mediaWrap.clientHeight;
              const oldScrollTop = document.documentElement.scrollTop;
              mediaWrap.classList.remove('yawf-WB_media_a_all');
              // 调整滚动条以适应高度变化
              requestAnimationFrame(function () {
                const newHeight = mediaWrap.clientHeight;
                document.documentElement.scrollTop = oldScrollTop - oldHeight + newHeight;
              });
            });
            mediaWrap.appendChild(foldContainer);
          }
        }
      });

      if (Number.isFinite(previewCount)) css.append(`.yawf-WB_media_a_more .li_${previewCount} ~ .WB_pic { display: none; }`);
      css.append(`
.yawf-WB_pic_more { position: absolute; top: 0; left: 0; bottom: 0; right: 0; background: rgba(0, 0, 0, 0.4); font-size: 24px; color: white; text-align: center; line-height: 110px; text-shadow: 0 0 4px black; z-index: 1; cursor: point; }
.yawf-WB_media_a_all .yawf-WB_pic_more { display: none; }
.yawf-WB_media_a_all .yawf-WB_media_a_more .WB_pic { display: block; }
.yawf-WB_media_a_fold { display: none; }
.yawf-WB_media_a_show { display: inline; }
.yawf-WB_media_a_all .yawf-WB_media_a_fold { display: inline; }
.yawf-WB_media_a_all .yawf-WB_media_a_show { display: none; }
.yawf-WB_media_a_ctrl { clear: both; margin-left: 10px; padding-top: 4px; }
`);
      if (previewWidth === 4) {
        const smallImage = feeds.layout.smallImage.isEnabled();
        if (smallImage) {
          css.append('.WB_feed_v3 .WB_media_a.yawf-WB_media_a_more { width: 345px; }');
        } else {
          css.append('.WB_feed_v3 .WB_media_a.yawf-WB_media_a_more { width: 456px; }');
        }
      }

      if (lastImageMask) {
        document.addEventListener('click', event => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const mask = target.closest('.yawf-WB_pic_more');
          if (!mask) return;
          const mediaWrap = mask.closest('.WB_media_wrap');
          mediaWrap.classList.add('yawf-WB_media_a_all');
          event.stopPropagation();
        }, true);
      }
    },
  });

  Object.assign(i18n, {
    imagePreviewMore: { cn: '超过 9 张配图的微博|预览{{count}}||有图片未显示时{{more}}', tw: '超過 9 張配圖的微博顯示|預覽{{count}}||有圖片未顯示時{{more}}', en: 'Thumbnails for feeds with more than 9 images | preview {{count}}||with {{more}}' },
    imagePreviewFirst3x2: { cn: '前 6 张（每行 3 张）', tw: '前 6 張（每列 3 張）', en: 'first 6 (3 each row)' },
    imagePreviewFirst4x2: { cn: '前 8 张（每行 4 张）', tw: '前 8 張（每列 4 張）', en: 'first 8 (4 each row)' },
    imagePreviewFirst3x3: { cn: '前 9 张（每行 3 张）', tw: '前 9 張（每列 3 張）', en: 'first 9 (3 each row)' },
    imagePreviewFirst4x3: { cn: '前 12 张（每行 4 张）', tw: '前 12 張（每列 4 張）', en: 'first 12 (4 each row)' },
    imagePreviewAll3: { cn: '全部图片（每行 3 张）', tw: '全部圖片（每列 3 張）', en: 'all (3 each row)' },
    imagePreviewAll4: { cn: '全部图片（每行 4 张）', tw: '全部圖片（每列 4 張）', en: 'all (4 each row)' },
    imagePreviewUseText: { cn: '在图片后显示展开收起按钮', tw: '在圖片後顯示展開收起按鈕', en: 'show / hide button after images' },
    imagePreviewUseMask: { cn: '最后一张预览显示剩余图片数量', tw: '最後一張預覽顯示剩餘圖片數量', en: 'number of remaining on last image' },
  });
  media.imagePreviewAll = rule.Rule({
    id: 'image_preview_all',
    version: 49,
    parent: media.media,
    template: () => i18n.imagePreviewMore,
    ref: {
      count: {
        type: 'select',
        initial: '3x3',
        select: [
          { value: '3x2', text: () => i18n.imagePreviewFirst3x2 },
          { value: '4x2', text: () => i18n.imagePreviewFirst4x2 },
          { value: '3x3', text: () => i18n.imagePreviewFirst3x3 },
          { value: '4x3', text: () => i18n.imagePreviewFirst4x3 },
          { value: '3x0', text: () => i18n.imagePreviewAll3 },
          { value: '4x0', text: () => i18n.imagePreviewAll4 },
        ],
      },
      more: {
        type: 'select',
        initial: 'text',
        select: [
          { value: 'text', text: () => i18n.imagePreviewUseText },
          { value: 'mask', text: () => i18n.imagePreviewUseMask },
        ],
      },
    },
    init() {
      this.addConfigListener(config => {
        if (config) media.allImagesAvailable.setConfig(true);
      });
      this.ref.count.addConfigListener(count => {
        const showAll = count.endsWith('0');
        const items = this.ref.more.getRenderItems();
        items.forEach(item => {
          const container = item.parentNode;
          if (showAll) container.style.display = 'none';
          else container.style.display = 'inline';
        });
      });
      // 实现在上面
    },
  });

  Object.assign(i18n, {
    pauseAnimatedImage: { cn: '动画图像(GIF)在缩略图显示时保持静止{{i}}', hk: '動畫圖像(GIF)在所圖顯示時保持靜止{{i}}', tw: '動畫圖像(GIF)在所圖顯示時保持靜止{{i}}', en: 'Pause animated thumbnail (GIF) {{i}}' },
    pauseAnimatedImageDetail: { cn: '该功能仅影响显示效果，并不会降低网络数据用量。' },
  });

  media.pauseAnimatedImage = rule.Rule({
    id: 'feed_no_animated_image',
    version: 1,
    parent: media.media,
    template: () => i18n.pauseAnimatedImage,
    ref: {
      i: { type: 'bubble', icon: 'warn', template: () => i18n.pauseAnimatedImageDetail },
    },
    ainit() {
      // 其实不写 encodeURI 效果上也没问题，但是微博转发文字生成看到 > 就会出错
      const emptyImage = encodeURI('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      observer.dom.add(function pauseAnimatedImage() {
        const images = Array.from(document.querySelectorAll([
          '.PCD_photolist img[src$=".gif"]:not([yawf-pause-animate])',
          '.WB_pic img[src$=".gif"]:not([yawf-pause-animate])',
          'img.W_img_face[src$=".gif"]:not([yawf-pause-animate])',
        ].join(',')));
        images.forEach(async function (image) {
          const url = image.src;
          image.src = emptyImage;
          image.setAttribute('ori-src', url);
          image.setAttribute('yawf-ori-src', url);
          image.setAttribute('yawf-pause-animate', 'yawf-pause-animate');
          const dataUrl = await request.getImage(url).then(blob => urls.blobToDataUrl(blob));
          const img = new Image();
          img.addEventListener('load', () => {
            const width = img.naturalWidth, height = img.naturalHeight;
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            image.src = canvas.toDataURL('image/png');
          });
          img.src = dataUrl;
        });
      });
      css.append(`
.PCD_photolist img[src$=".gif"]:not([yawf-pause-animate]),
.WB_pic img[src$=".gif"]:not([yawf-pause-animate]),
.WB_gif_video_box
{ display: none !important; }
.WB_gif_box { visibility: visible !important; }
`);
    },
  });

  Object.assign(i18n, {
    useBuiltInVideoPlayer: { cn: '使用浏览器原生视频播放器{{i}}||音量{{volume}}%|{{memorize}}记忆上一次设置的音量', hk: '使用瀏覽器內建影片播放器{{i}}||音量{{volume}}%|{{memorize}}記住上一次設置的音量', en: 'Use browser built-in video player {{i}}||Volume {{volume}} | {{memorize}} memorize last volume' },
    useBuiltInVideoPlayerDetail: { cn: '一次性解决自动播放和交互逻辑的各种问题，开启时其他视频相关的改造功能不再生效。不支持直播视频。播放可能不会被微博正确计入播放数。' },
    mediaVideoType: { cn: '视频', hk: '影片', tw: '影片', en: 'Video' },
  });

  media.useBuiltInVideoPlayer = rule.Rule({
    id: 'feed_built_in_video_player',
    version: 1,
    parent: media.media,
    template: () => i18n.useBuiltInVideoPlayer,
    ref: {
      volume: { type: 'range', min: 0, max: 100, initial: 100 },
      memorize: { type: 'boolean' },
      i: { type: 'bubble', icon: 'warn', template: () => i18n.useBuiltInVideoPlayerDetail },
    },
    ainit() {
      const rule = this;
      const replaceWeiboVideoPlayer = function replaceWeiboVideoPlayer() {
        const containers = document.querySelectorAll('li.WB_video[node-type="fl_h5_video"][video-sources]');
        containers.forEach(function (container) {
          const smallImage = yawf.rules.feeds.layout.smallImage.getConfig();
          const cover = container.querySelector('[node-type="fl_h5_video_pre"] img');
          if (!cover) return;
          const video = container.querySelector('video');
          if (video) video.src = 'data:text/plain,42';
          const videoSourceData = new URLSearchParams(container.getAttribute('video-sources'));
          const videoSource = videoSourceData.get(videoSourceData.get('qType'));
          const newContainer = document.createElement('li');
          newContainer.className = container.className;
          newContainer.classList.add('yawf-WB_video');
          const newVideo = document.createElement('video');
          newVideo.poster = cover.src;
          newVideo.src = videoSource.replace(/^http:/, 'https:');
          newVideo.preload = 'none';
          newVideo.controls = !smallImage;
          newVideo.autoplay = false;
          const updatePlayState = function () {
            const isPlaying = !newVideo.paused || newVideo.seeking;
            if (isPlaying) newContainer.setAttribute('yawf-video-play', '');
            else newContainer.removeAttribute('yawf-video-play');
            if (smallImage) newVideo.controls = isPlaying;
          };
          newVideo.addEventListener('play', updatePlayState);
          newVideo.addEventListener('pause', updatePlayState);
          if (smallImage) {
            newContainer.addEventListener('click', () => {
              if (!newContainer.hasAttribute('yawf-video-play')) newVideo.play();
            });
            const tip = document.createElement('i');
            tip.className = 'W_icon_tag_v2';
            tip.textContent = i18n.mediaVideoType;
            newContainer.appendChild(tip);
          }
          newVideo.volume = rule.ref.volume.getConfig() / 100;
          if (rule.ref.memorize.getConfig()) {
            newVideo.addEventListener('volumechange', () => {
              rule.ref.volume.setConfig(Math.round(newVideo.volume * 100));
            });
            newVideo.addEventListener('play', () => {
              newVideo.volume = rule.ref.volume.getConfig() / 100;
            });
          }
          newContainer.appendChild(newVideo);
          container.parentNode.replaceChild(newContainer, container);
        });
      };
      observer.dom.add(replaceWeiboVideoPlayer);
      css.append(`
li.WB_video[node-type="fl_h5_video"][video-sources] > div[node-type="fl_h5_video_pre"],
li.WB_video[node-type="fl_h5_video"][video-sources] > div[node-type="fl_h5_video_disp"] { display: none !important; }
.yawf-WB_video { transition: width, height 0.2s; }
.yawf-WB_video video { width: 100%; height: 100%; position: absolute; top: 0; bottom: 0; left: 0; right: 0; margin: auto; }
.WB_media_a .WB_video.yawf-WB_video { cursor: unset; }
.yawf-WB_video .W_icon_tag_v2 { z-index: 1; }
.WB_video[yawf-video-play] .W_icon_tag_v2 { display: none !important; }
`);
      util.inject(function () {
        const FakeVideoPlayer = function e() { };
        FakeVideoPlayer.prototype.thumbnail = function () { };
        FakeVideoPlayer.prototype.playStatus = function () { };
        if (window.VideoPlayer) {
          window.VideoPlayer = FakeVideoPlayer;
          return;
        }
        let globalVideoPlayer = void 0;
        Object.defineProperty(window, 'VideoPlayer', {
          get() { return globalVideoPlayer; },
          set(_) { globalVideoPlayer = FakeVideoPlayer; },
          enumerable: true,
          configurable: false,
        });
      });
      // 这几行分别是不显示视频弹层按钮，显示全屏按钮，以及点视频时不弹层
      // 因为直播视频没办法替换成原生播放器，所以这两个功能还需要保留
      // 这里直接把这几个功能放在这里，不单独做一个功能了
      css.append(`
.wbv-pop-control { display: none !important; }
.wbv-fullscreen-control { display: block !important; }
.wbv-pop-layer { display: none !important; }
`);
    },
  });

}());
