import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AccordionSection = ({
  title,
  children,
  isOpen,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  return (
    <View className="bg-white rounded-xl shadow-md overflow-hidden mb-4">
      <TouchableOpacity onPress={handleToggle} className="p-4 flex-row justify-between items-center">
        <Text className="text-lg font-semibold">{title}</Text>
        <Text className="text-lg font-bold">
          {isOpen ? '-' : '+'}
        </Text>
      </TouchableOpacity>
      {isOpen && (
        <View className="p-4 border-t border-gray-100">
          {children}
        </View>
      )}
    </View>
  );
};

const PlantMonitorApp = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Accordion state
  const [aboutOpen, setAboutOpen] = useState(false);
  const [causesOpen, setCausesOpen] = useState(false);
  const [treatmentOpen, setTreatmentOpen] = useState(false);

  const SERVER_URL = `${process.env.EXPO_PUBLIC_PYTHON_SERVER}:8000`;

  const fetchLatestData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${SERVER_URL}/latest_snapshot`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLatestData();
    const interval = setInterval(fetchLatestData, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLatestData();
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="p-4">
          <Text className="text-2xl font-bold text-center mb-2">
            Plant Health Monitor
          </Text>
          <Text className="text-gray-600 text-center mb-6">
            Real-time disease detection
          </Text>

          {loading && !data && (
            <View className="items-center justify-center p-8">
              <ActivityIndicator size="large" color="#10b981" />
              <Text className="mt-4 text-gray-600">Loading latest data…</Text>
            </View>
          )}

          {error && (
            <View className="bg-red-100 p-4 rounded-lg mb-4">
              <Text className="text-red-800">{error}</Text>
              <TouchableOpacity
                className="bg-red-500 py-2 px-4 rounded-lg mt-3 items-center"
                onPress={fetchLatestData}
              >
                <Text className="text-white font-medium">Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {data && (
            <>
              {/* IMAGE & STATUS */}
              <View className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
                {data.image ? (
                  <Image
                    source={{ uri: data.image }}
                    className="w-full h-72"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-72 bg-gray-200 items-center justify-center">
                    <Text className="text-gray-500">No image available</Text>
                  </View>
                )}
                <View className="absolute top-2 right-2">
                  <View
                    className={`${
                      data.prediction['Disease Prediction'].includes('Healthy')
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    } px-3 py-1 rounded-full`}
                  >
                    <Text className="text-white font-medium">
                      {data.prediction['Disease Prediction'].includes(
                        'Healthy'
                      )
                        ? 'Healthy'
                        : 'Disease Detected'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* TIMESTAMP & Basic Info */}
              <View className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
                <View className="p-4 border-b border-gray-100">
                  <Text className="text-lg font-bold">Analysis Results</Text>
                  <Text className="text-xs text-gray-500">
                    Last updated: {formatTimestamp(data.prediction.timestamp)}
                  </Text>
                </View>

                <View className="p-4 mb-4">
                  <Text className="font-medium text-gray-600">Disease:</Text>
                  <Text className="font-bold text-xl">
                    {data.prediction['Disease Prediction']}
                  </Text>
                </View>
              </View>

              {/* ACCORDIONS */}
              <AccordionSection
                title="About"
                isOpen={aboutOpen}
                onToggle={() => setAboutOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data.prediction.About || 'No details available.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Causes"
                isOpen={causesOpen}
                onToggle={() => setCausesOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data.prediction.Causes || 'No details available.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Treatment Plan"
                isOpen={treatmentOpen}
                onToggle={() => setTreatmentOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data.prediction['Treatment Plan'] ||
                    'No details available.'}
                </Text>
              </AccordionSection>
            </>
          )}

          <TouchableOpacity
            className="bg-emerald-500 py-3 px-4 rounded-lg items-center mb-6"
            onPress={fetchLatestData}
          >
            <Text className="text-white font-bold">Refresh Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PlantMonitorApp;
