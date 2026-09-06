// logs.js
const util = require('../../utils/util.js')

Component({
  data: {
    logs: []
  },
  lifetimes: {
    attached() {
      this.setData({
        logs: (wx.getStorageSync('logs') || []).map(log => {
          return {
            date: util.formatTime(new Date(log)),
            timeStamp: log
          }
        })
      })
    }
  },
  methods: {
    // ==================== 分享 ====================

    /**
     * 转发给好友
     */
    onShareAppMessage() {
      return {
        title: '系统日志',
        path: '/pages/logs/logs',
      };
    },

    /**
     * 分享到朋友圈
     */
    onShareTimeline() {
      return {
        title: '系统日志',
      };
    },
  },
})
