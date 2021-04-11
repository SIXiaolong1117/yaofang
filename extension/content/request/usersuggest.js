/**
 * 当输入用户名时，给出一个用户列表以供选择
 */
; (function () {

  const yawf = window.yawf;
  const util = yawf.util;
  const network = yawf.network;
  const request = yawf.request = yawf.request ?? {};

  const userSuggestCache = new Map();

  const userSuggestByTop = async function (key) {
    const url = new URL('https://s.weibo.com/ajax/topsuggest.php');
    url.searchParams.set('_k', network.getUniqueKey());
    url.searchParams.set('_t', 1);
    url.searchParams.set('_v', network.fakeCallback());
    url.searchParams.set('key', key);
    url.searchParams.set('uid', yawf.init.page.$CONFIG.uid);
    util.debug('fetch url %s', url);
    const resp = await network.fetchText(url);
    const users = Array.from(network.parseJson(resp).data?.user ?? []);
    const result = users.map(user => ({
      id: user.u_id + '',
      name: user.u_name,
      avatar: user.u_pic,
    }));
    util.debug('Got suggestion users for %o from top: %o', key, result);
    return result;
  };
  const userSuggestByFollow = async function (key) {
    const url = new URL('https://weibo.com/aj/relation/attention');
    url.searchParams.set('_rnd', network.getUniqueKey());
    url.searchParams.set('_t', 0);
    url.searchParams.set('ajwvr', 6);
    url.searchParams.set('q', key);
    url.searchParams.set('type', 0);
    util.debug('fetch url %s', url);
    const resp = await network.fetchJson(url);
    const users = Array.from(resp.data);
    const result = users.map(user => ({
      id: user.uid + '',
      name: user.screen_name,
    }));
    util.debug('Got suggestion users for %o from attention: %o', key, result);
    return result;
  };
  const userSuggest = async function userSuggest(key) {
    const suggests = await Promise.all([
      userSuggestByFollow(key).then(users => users, () => []),
      userSuggestByTop(key).then(users => users, () => []),
    ]);
    const list = suggests.reduce((a, b) => a.concat(b), []).map(user => ({
      id: user.id,
      name: user.name,
    }));
    const result = [...new Map(list.map(user => [user.id, user])).values()];
    util.debug('Got suggestion users for %o: %o', key, result);
    return result;
  };
  const userSuggestCached = async function userSuggestCached(key) {
    if (userSuggestCache.has(key)) {
      return userSuggestCache.get(key);
    }
    const promise = userSuggest(key);
    userSuggestCache.set(key, promise);
    try {
      const result = await promise;
      return result;
    } catch (e) {
      userSuggestCache.delete(key);
      return [];
    }
  };
  request.userSuggest = userSuggestCached;

}());
