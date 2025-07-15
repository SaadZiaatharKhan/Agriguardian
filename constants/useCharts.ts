import { useState, useEffect } from 'react';
import { icons } from "@/constants/icons";
import { useUserLocation } from "@/hooks/useUserLocation";

export function useCharts() {
  const { latitude, longitude, errorMsg } = useUserLocation();
  const [isReady, setIsReady] = useState(false);
  
  const API_URL = process.env.EXPO_PUBLIC_CHARTS || "https://api.open-meteo.com/v1/forecast?";
  
  // Define base charts without location data
  const baseCharts = [
    {
      id: 1,
      title: "Temperature (in °C)",
      icon: icons.temperature,
      color: "44, 175, 254",
      backgroundGradientFrom: "#89bada",
      background: "#b2d3e8",
      type: "temperature_2m"
    },
    {
      id: 2,
      title: "Relative Humidity (in %)",
      icon: icons.humidity,
      color: "84, 79, 197",
      backgroundGradientFrom: "#8e8bda",
      background: "#b6b4e9",
      type: "relative_humidity_2m"
    },
    {
      id: 3,
      title: "Precipitation (in mm)",
      icon: icons.rain,
      color: "250, 75, 66",
      backgroundGradientFrom: "#fc6f68",
      background: "#ffa29d",
      type: "precipitation"
    },
    {
      id: 4,
      title: "Precipitation Probability (in %)",
      icon: icons.rain,
      color: "250, 75, 66",
      backgroundGradientFrom: "#67ffb3",
      background: "#9cffce",
      type: "precipitation_probability"
    },
    {
      id: 5,
      title: "Wind Speed (in km/h)",
      icon: icons.wind_speed,
      color: "254, 106, 53",
      backgroundGradientFrom: "#ff8d64",
      background: "#ffb59a",
      type: "wind_speed_10m" // Adjusted to match API parameter
    },
    {
      id: 6,
      title: "Wind Direction (in °)",
      icon: icons.wind_direction,
      color: "107, 138, 188",
      backgroundGradientFrom: "#94abd0",
      background: "#b9c9e3",
      type: "wind_direction_10m" // Adjusted to match API parameter
    },
    {
      id: 7,
      title: "Soil Temperature (in °C)",
      icon: icons.soil_temperaure,
      color: "200, 60, 249",
      backgroundGradientFrom: "#d568fb",
      background: "#e59efd",
      type: "soil_temperature_6cm" // Adjusted to match API parameter
    },
    {
      id: 8,
      title: "Soil Moisture (in m³/m³)",
      icon: icons.soil_moisture,
      color: "200, 60, 249",
      backgroundGradientFrom: "#d568fb",
      background: "#e59efd",
      type: "soil_moisture_0_to_7cm" // Adjusted to match API parameter
    },
  ];
  
  // Default charts with fallback coordinates
  const [charts, setCharts] = useState(baseCharts.map(chart => ({
    ...chart,
    urldata: `${API_URL}latitude=52.52&longitude=13.41&hourly=${chart.type}`
  })));
  
  // Update charts when location changes
  useEffect(() => {
    if (latitude && longitude) {
      console.log(`Location updated: ${latitude}, ${longitude}`);
      const updatedCharts = baseCharts.map(chart => ({
        ...chart,
        urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=${chart.type}`
      }));
      setCharts(updatedCharts);
      setIsReady(true);
    } else {
      console.log('Waiting for location data...');
    }
  }, [latitude, longitude]);
  
  return { charts, isReady, errorMsg };
}