import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { debounce } from 'lodash';

const API_URL = `${process.env.EXPO_PUBLIC_PYTHON_SERVER}:8000`;

const AccordionItem = ({ title, content }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="bg-white rounded-xl mb-4 shadow">
      <TouchableOpacity
        className="p-4 flex-row justify-between items-center"
        onPress={() => setExpanded(!expanded)}
      >
        <Text className="text-base font-bold text-gray-800">{title}</Text>
        <Text className="text-xl text-gray-500">{expanded ? '-' : '+'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View className="p-4 pt-0">
          <Text className="text-gray-700 leading-6">{content}</Text>
        </View>
      )}
    </View>
  );
};

const SearchData = () => {
  const [crop, setCrop] = useState('');
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRawData, setShowRawData] = useState(false);

  const fetchMarketData = async (cropName) => {
    if (!cropName.trim()) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/searchdata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cropName })
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      // unwrap market_insights
      setMarketData(data.market_insights);
    } catch (err) {
      setError('Failed to fetch market trends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useCallback(
    debounce((text) => {
      fetchMarketData(text);
    }, 500),
    []
  );

  const handleChange = (text) => {
    setCrop(text);
    debouncedFetch(text);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50 p-4"
      contentContainerStyle={{ paddingBottom: 80 }} // ensure content is above tab bar
    >
      <Text className="text-2xl font-bold mb-4 text-gray-800">Market Price Trends</Text>
      <TextInput
        className="w-full border border-gray-300 rounded-lg p-3 mb-4 bg-white"
        placeholder="Enter crop name..."
        value={crop}
        onChangeText={handleChange}
      />

      {loading && <ActivityIndicator size="large" color="#4775EA" className="my-5" />}
      {error ? <Text className="text-red-500 my-4">{error}</Text> : null}

      {marketData && (
        <View className="mt-4 mb-10">
          {/* Price Summary */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow">
            <Text className="text-xl font-bold mb-3 text-gray-800 capitalize">{crop}</Text>
            <View className="flex-row justify-between mb-3">
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Current Price</Text>
                <Text className="text-lg font-bold text-gray-800">₹{marketData["Current Price"]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Average Price</Text>
                <Text className="text-lg font-bold text-gray-800">₹{marketData["Average Price"]}</Text>
              </View>
            </View>
            <View>
              <Text className="text-sm text-gray-500">Selling Advice</Text>
              <Text className="text-base leading-6 text-gray-800">{marketData["Selling Advice"]}</Text>
            </View>
          </View>

          {/* Other Factors in Accordions */}
          <AccordionItem title="Market Insights" content={marketData["Market Insights"]} />
          <AccordionItem title="Market Demand" content={marketData["Market Demand"]} />
          <AccordionItem title="Market Supply" content={marketData["Market Supply"]} />
          <AccordionItem title="Government Policy" content={marketData["Government Policy"]} />
          <AccordionItem title="Risk Alert" content={marketData["Risk Alert"]} />

        </View>
      )}
    </ScrollView>
  );
};

export default SearchData;
