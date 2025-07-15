import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager
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
  onToggle
}: {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };
  return (
    <View className="bg-white rounded-xl shadow-md overflow-hidden mb-4">
      <TouchableOpacity onPress={toggle} className="p-4 flex-row justify-between items-center">
        <Text className="text-lg font-semibold">{title}</Text>
        <Text className="text-lg font-bold">{isOpen ? '-' : '+'}</Text>
      </TouchableOpacity>
      {isOpen && <View className="p-4 border-t border-gray-100">{children}</View>}
    </View>
  );
};

const Recommendations = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Accordion state
  const [recommendedOpen, setRecommendedOpen] = useState(false);
  const [weedOpen, setWeedOpen] = useState(false);
  const [intercultureOpen, setIntercultureOpen] = useState(false);
  const [irrigationOpen, setIrrigationOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [plantingOpen, setPlantingOpen] = useState(false);
  const [soilOpen, setSoilOpen] = useState(false);

  const SERVER_URL = 'http://10.134.61.178:8000';

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${SERVER_URL}/latest_snapshot`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setData(json.prediction);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(`Failed to load analysis: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalysis();
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="p-4">
          <Text className="text-2xl font-bold text-center mb-6">Best Practices</Text>

          {loading && !data && (
            <View className="items-center justify-center p-8">
              <ActivityIndicator size="large" color="#10b981" />
              <Text className="mt-4 text-gray-600">Loading best practices…</Text>
            </View>
          )}

          {error && (
            <View className="bg-red-100 p-4 rounded-lg mb-4">
              <Text className="text-red-800">{error}</Text>
              <TouchableOpacity
                className="bg-red-500 py-2 px-4 rounded-lg mt-3 items-center"
                onPress={fetchAnalysis}
              >
                <Text className="text-white font-medium">Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {data && (
            <>
              <View className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
                <View className="p-4 border-b border-gray-100">
                  <Text className="text-xs text-gray-500">
                    Last updated: {formatTimestamp(data.timestamp)}
                  </Text>
                </View>
              </View>

              <AccordionSection
                title="Recommended Crops"
                isOpen={recommendedOpen}
                onToggle={() => setRecommendedOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data['Recommended Crops'] || 'No recommendation available.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Weed Control"
                isOpen={weedOpen}
                onToggle={() => setWeedOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data['Weed Control'] || 'No guidance available.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Intercultural Operations"
                isOpen={intercultureOpen}
                onToggle={() => setIntercultureOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data['Intercultural Operations'] || 'No operations recommended.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Irrigation"
                isOpen={irrigationOpen}
                onToggle={() => setIrrigationOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data.Irrigation || 'No irrigation advice.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Storage Techniques"
                isOpen={storageOpen}
                onToggle={() => setStorageOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data['Storage Techniques'] || 'No storage methods.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Planting Methods"
                isOpen={plantingOpen}
                onToggle={() => setPlantingOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data['Planting Methods'] || 'No planting techniques.'}
                </Text>
              </AccordionSection>

              <AccordionSection
                title="Soil Management"
                isOpen={soilOpen}
                onToggle={() => setSoilOpen(prev => !prev)}
              >
                <Text className="text-gray-800">
                  {data['Soil Management'] || 'No soil management tips.'}
                </Text>
              </AccordionSection>

              <TouchableOpacity
                className="bg-emerald-500 py-3 px-4 rounded-lg items-center mb-6"
                onPress={fetchAnalysis}
              >
                <Text className="text-white font-bold">Refresh Best Practices</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Recommendations;
