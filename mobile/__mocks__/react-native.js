// Mock for react-native
module.exports = {
  Platform: { OS: 'ios', select: (objs) => objs.ios },
  StyleSheet: {
    create: (styles) => styles,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  SafeAreaView: 'SafeAreaView',
  StatusBar: 'StatusBar',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
  },
};
