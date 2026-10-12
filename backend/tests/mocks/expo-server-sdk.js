class Expo {
  static isExpoPushToken = jest.fn().mockReturnValue(true);
  sendPushNotificationsAsync = jest.fn().mockResolvedValue([]);
}
module.exports = Expo;
module.exports.default = Expo;
module.exports.Expo = Expo;
