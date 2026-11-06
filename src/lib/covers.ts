import type { ImageSource } from 'expo-image';

import type { Activity, ActivityCategory } from './types';

/** Default cover picture of every activity category (drawn for Matchwerk, see scripts/generate-activity-covers.cjs). */
export const CATEGORY_COVERS: Record<ActivityCategory, number> = {
  coffee: require('../../assets/activities/coffee.jpg'),
  hike: require('../../assets/activities/hike.jpg'),
  drinks: require('../../assets/activities/drinks.jpg'),
  games: require('../../assets/activities/games.jpg'),
  sport: require('../../assets/activities/sport.jpg'),
  culture: require('../../assets/activities/culture.jpg'),
  food: require('../../assets/activities/food.jpg'),
  other: require('../../assets/activities/other.jpg'),
};

export const coverOf = (a: Pick<Activity, 'coverUrl' | 'category'>): ImageSource | number =>
  a.coverUrl ? { uri: a.coverUrl } : CATEGORY_COVERS[a.category];
