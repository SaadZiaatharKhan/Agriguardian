import { View, Text, TouchableOpacity, Image } from 'react-native'
import React, { useContext, useState } from 'react'
import { icons } from '@/constants/icons'
import { UserContext } from './UserContext';
import UserProfile from './UserProfile';

const Profile = () => {
    const [showModal, setModal] = useState(false);

  return (
    <View className='flex items-center'>
        <TouchableOpacity onPress={()=>{setModal(!showModal)}}>
            <Image source={icons.user_modal} className="w-6 h-6" resizeMode="contain" />
        </TouchableOpacity>
        {showModal && <UserProfile showModal={showModal} />}       
    </View>
  )
}

export default Profile