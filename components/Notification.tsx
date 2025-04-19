import { View, Text, Pressable, Image } from 'react-native'
import React from 'react'
import { icons } from '@/constants/icons'

const Notification = () => {
  return (
    <View className='p-2 m-2'>
      <Pressable>
        <Image source={icons.notification_read} className="w-6 h-6" resizeMode="contain" />
      </Pressable>
    </View>
  )
}

export default Notification