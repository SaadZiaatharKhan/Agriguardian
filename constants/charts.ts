import { icons } from "@/constants/icons";
import { useUserLocation } from "@/hooks/useUserLocation";

export function useCharts() {
  const { latitude, longitude, errorMsg } = useUserLocation();
  
  const API_URL = process.env.EXPO_PUBLIC_CHARTS || "https://api.open-meteo.com/v1/forecast?";
  
  const charts = [
    {
      id: 1,
      title: "Temperature (in °C)",
      icon: icons.temperature,
      color: "44, 175, 254",
      backgroundGradientFrom: "#89bada",
      background: "#b2d3e8",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m`,
      type: "temperature_2m"
    },
    {
      id: 2,
      title: "Relative Humidity (in %)",
      icon: icons.humidity,
      color: "84, 79, 197",
      backgroundGradientFrom: "#8e8bda",
      background: "#b6b4e9",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=relative_humidity_2m`,
      type: "relative_humidity_2m"
    },
    {
      id: 3,
      title: "Precipitation (in mm)",
      icon: icons.rain,
      color: "250, 75, 66",
      backgroundGradientFrom: "#fc6f68",
      background: "#ffa29d",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=precipitation`,
      type: "precipitation"
    },
    {
      id: 4,
      title: "Precipitation Probability (in %)",
      icon: icons.rain,
      color: "250, 75, 66",
      backgroundGradientFrom: "#67ffb3",
      background: "#9cffce",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=precipitation_probability`,
      type: "precipitation_probability"
    },
    {
      id: 5,
      title: "Wind Speed (in km/h)",
      icon: icons.wind_speed,
      color: "254, 106, 53",
      backgroundGradientFrom: "#ff8d64",
      background: "#ffb59a",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=wind_speed_80m`,
      type: "wind_speed_80m"
    },
    {
      id: 6,
      title: "Wind Direction (in °)",
      icon: icons.wind_direction,
      color: "107, 138, 188",
      backgroundGradientFrom: "#94abd0",
      background: "#b9c9e3",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=wind_direction_80m`,
      type: "wind_direction_80m"
    },
    {
      id: 7,
      title: "Soil Temperature (in °C)",
      icon: icons.soil_temperaure,
      color: "200, 60, 249",
      backgroundGradientFrom: "#d568fb",
      background: "#e59efd",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=soil_temperature_18cm`,
      type: "soil_temperature_18cm"
    },
    {
      id: 8,
      title: "Soil Moisture (in m³/m³)",
      icon: icons.soil_moisture,
      color: "200, 60, 249",
      backgroundGradientFrom: "#d568fb",
      background: "#e59efd",
      urldata: `${API_URL}latitude=${latitude}&longitude=${longitude}&hourly=soil_moisture_9_to_27cm`,
      type: "soil_moisture_9_to_27cm"
    },
  ];
  
  return { charts, errorMsg };
}