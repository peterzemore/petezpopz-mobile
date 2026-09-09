// PetezPopz — product grid column count by window width
//
// The grids were designed as two columns on a phone. On an iPad (native since
// build 10) a two-column grid turns each card into a 400pt tile, so pick the
// count from the live window width instead. Pass the result to FlatList as
// both numColumns and key: numColumns cannot change on a mounted FlatList.
import { useWindowDimensions } from 'react-native';

export function useGridColumns(): number {
  const { width } = useWindowDimensions();
  if (width >= 900) return 4;
  if (width >= 600) return 3;
  return 2;
}
