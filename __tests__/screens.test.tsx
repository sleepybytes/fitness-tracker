/// <reference types="jest" />
import { fireEvent, render, screen } from '@testing-library/react-native';

import InsightsScreen from '../app/(tabs)/insights';
import TodayScreen from '../app/(tabs)/index';
import SettingsScreen from '../app/(tabs)/settings';
import { toKey } from '../src/lib/date';
import { useTracker } from '../src/store/useTracker';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
  router: { setParams: jest.fn() },
}));

beforeEach(() => useTracker.getState().resetAll());

describe('Today screen', () => {
  it('shows the three sections', async () => {
    await render(<TodayScreen />);
    expect(screen.getByRole('tab', { name: /^Diet/ })).toBeTruthy();
    expect(screen.getByText('Post-workout dinner')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: /^Supplements/ }));
    expect(screen.getByText('Protein powder')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: /^Exercise/ }));
    expect(screen.getByText('What did you train?')).toBeTruthy();
  });

  it('ticks a whole meal and logs a supplement dose', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Mark Breakfast done'));
    await fireEvent.press(screen.getByRole('tab', { name: /^Supplements/ }));
    await fireEvent.press(screen.getByLabelText('2 scoops'));

    const log = useTracker.getState().logs[toKey(new Date())];
    expect(Object.keys(log.items)).toEqual(
      expect.arrayContaining(['bf_eggs', 'bf_oats', 'bf_milk', 'bf_banana', 'bf_apple', 'bf_dryfruits']),
    );
    expect(log.supplements.protein.amount).toBe(2);
    expect(screen.getByText('2 scoops')).toBeTruthy(); // "taken" pill
    expect(screen.getByRole('tab', { name: 'Supplements, 1/3' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: /^Diet/ }));
    expect(screen.getByLabelText('Mark Breakfast not done')).toBeTruthy();
  });

  it('adds water with the button and the drops', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Add 250 ml water'));
    expect(useTracker.getState().logs[toKey(new Date())].waterMl).toBe(250);
    await fireEvent.press(screen.getByLabelText('Set water to 1.5 litres'));
    expect(useTracker.getState().logs[toKey(new Date())].waterMl).toBe(1500);
    expect(screen.getAllByText('1.5 L').length).toBeGreaterThan(0);
  });
});

describe('Insights screen', () => {
  it('renders with no data and with logged days', async () => {
    await render(<InsightsScreen />);
    expect(screen.getByText('Adherence')).toBeTruthy();
    expect(screen.getByText('Today so far')).toBeTruthy();
  });
});

describe('Settings screen', () => {
  it('renders reminder switches for every meal and supplement', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Meal & supplement reminders')).toBeTruthy();
    expect(screen.getByText('Before bed')).toBeTruthy();
    expect(screen.getByText('Omega-3 oil')).toBeTruthy();
  });
});
