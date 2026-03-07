import qbittorrentProxyHandler from "./proxy";

const widget = {
  proxyHandler: qbittorrentProxyHandler,

  mappings: {
    transfer: {
      endpoint: "transfer/info",
    },
    torrents: {
      endpoint: "torrents/info",
      optionalParams: ["filter"],
    },
  },
};

export default widget;
