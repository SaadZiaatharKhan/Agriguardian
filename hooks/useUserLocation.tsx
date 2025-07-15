import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export function useUserLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const latitude = location?.coords?.latitude || 51.5074; // Default: London
  const longitude = location?.coords?.longitude || -0.1278;
  
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }
        
        const location = await Location.getCurrentPositionAsync({});
        setLocation(location);
      } catch (err) {
        setErrorMsg('Error getting location');
        console.error('Location error:', err);
      }
    })();
  }, []);
  
  return { 
    location, 
    latitude, 
    longitude, 
    errorMsg 
  };
}