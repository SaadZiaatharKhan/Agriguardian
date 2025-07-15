import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Image } from 'react-native';

interface ChartProps {
  id: number;
  title: string;
  icon: any; // ImageSourcePropType
  color: string;
  backgroundGradientFrom: string;
  background: string;
  urldata: string;
  type: string;
}

// Month names for date formatting
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Chart({ id, title, icon, color, backgroundGradientFrom, background, urldata, type }: ChartProps) {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const screenWidth = Dimensions.get('window').width - 32; // Account for padding
  
  useEffect(() => {
    const fetchData = async () => {
      if (!urldata) {
        setError("Missing URL data");
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(urldata);
        const data = await response.json();
        
        if (data && data.hourly && Array.isArray(data.hourly[type]) && Array.isArray(data.hourly.time)) {
          setChartData(data);
        } else {
          setError("Invalid data format");
          console.error("Invalid data format:", data);
        }
      } catch (err) {
        setError("Failed to fetch data");
        console.error("Chart fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [urldata, type]);
  
  if (loading) {
    return (
      <View className="w-full h-60 flex items-center justify-center">
        <ActivityIndicator size="large" color="#00ab33" />
        <Text className="mt-2">Loading chart data...</Text>
      </View>
    );
  }
  
  if (error || !chartData) {
    return (
      <View className="w-full h-60 flex items-center justify-center">
        <Text className="text-red-500">{error || "No data available"}</Text>
      </View>
    );
  }
  
  // Extract times and values
  const times = chartData.hourly.time;
  const values = chartData.hourly[type];
  
  // Get current date
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Find the index of yesterday noon (12:00)
  let yesterdayIndex = -1;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  // Find index for yesterday at noon
  for (let i = 0; i < times.length; i++) {
    if (times[i].includes(yesterdayStr) && times[i].includes('T12:00')) {
      yesterdayIndex = i;
      break;
    }
  }
  
  // If we couldn't find yesterday noon, just use first entry that has yesterday's date
  if (yesterdayIndex === -1) {
    for (let i = 0; i < times.length; i++) {
      if (times[i].includes(yesterdayStr)) {
        yesterdayIndex = i;
        break;
      }
    }
  }
  
  // If still no yesterday, use the first point
  if (yesterdayIndex === -1) {
    yesterdayIndex = 0;
  }
  
  // Find the index of today noon (12:00)
  let todayIndex = -1;
  
  // Find index for today at noon
  for (let i = 0; i < times.length; i++) {
    if (times[i].includes(todayStr) && times[i].includes('T12:00')) {
      todayIndex = i;
      break;
    }
  }
  
  // If we couldn't find today noon, just use first entry that has today's date
  if (todayIndex === -1) {
    for (let i = 0; i < times.length; i++) {
      if (times[i].includes(todayStr)) {
        todayIndex = i;
        break;
      }
    }
  }
  
  // If still no today, use a point after yesterday
  if (todayIndex === -1) {
    todayIndex = yesterdayIndex + 24; // Approximately 24 hours later
  }
  
  // Calculate remaining points (5 more after today)
  const pointInterval = 24; // Hours between each point (one point per day)
  
  // Create our 7 evenly distributed points
  const sampledTimes = [];
  const sampledValues = [];
  
  // Start with yesterday
  sampledTimes.push(times[yesterdayIndex]);
  sampledValues.push(values[yesterdayIndex]);
  
  // Add today
  sampledTimes.push(times[todayIndex]);
  sampledValues.push(values[todayIndex]);
  
  // Add 5 more points for future days (at around noon)
  for (let i = 1; i <= 5; i++) {
    const nextIndex = todayIndex + (i * pointInterval);
    if (nextIndex < times.length) {
      sampledTimes.push(times[nextIndex]);
      sampledValues.push(values[nextIndex]);
    }
  }
  
  // Format labels: date only (better formatting for 7 points)
  const labels = sampledTimes.map((ts: string) => {
    const [date, time] = ts.split('T');
    const [year, month, day] = date.split('-');
    const monthName = MONTHS[parseInt(month) - 1];
    const dayNum = parseInt(day);
    
    return `${monthName} ${dayNum}`;
  });
  
  const chartDataConfig = {
    labels,
    datasets: [{ 
      data: sampledValues,
      color: (opacity = 1) => `rgba(${color}, ${opacity})`,
      strokeWidth: 2
    }]
  };
  
  const chartConfig = {
    backgroundGradientFrom: backgroundGradientFrom,
    backgroundGradientTo: '#f0f0f0',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(${color}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 12
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: `rgba(${color}, 0.8)`
    }
  };
  
  return (
    <View style={{ backgroundColor: background }} className="w-full p-4 rounded-lg">
      <View className="flex-row items-center mb-2">
        {icon && <Image source={icon} className="w-6 h-6 mr-2" resizeMode="contain" />}
        <Text className="text-xl font-bold">{title}</Text>
      </View>
      
      <LineChart
        data={chartDataConfig}
        width={screenWidth}
        height={220}
        chartConfig={chartConfig}
        bezier
        yAxisSuffix={getUnitSuffix(type)}
        withInnerLines={false}
        style={{ borderRadius: 12, marginVertical: 8 }}
        formatYLabel={(value) => formatValue(value, type)}
        verticalLabelRotation={0}
        horizontalLabelRotation={-15} // Angle labels to prevent overlap
        xLabelsOffset={-5}
      />
    </View>
  );
}

function getUnitSuffix(type: string): string {
  if (type.includes('temperature')) return '°C';
  if (type.includes('humidity') || type.includes('probability')) return '%';
  if (type.includes('precipitation')) return 'mm';
  if (type.includes('wind_speed')) return 'km/h';
  if (type.includes('wind_direction')) return '°';
  if (type.includes('moisture')) return 'm³/m³';
  return '';
}

function formatValue(value: string, type: string): string {
  const num = parseFloat(value);
  if (type.includes('moisture')) {
    return num.toFixed(3);
  }
  return num.toFixed(1);
}