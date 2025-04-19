import onboarding1 from "@/assets/images/onboarding1.jpg";
import onboarding2 from "@/assets/images/onboarding2.jpg";
import onboarding3 from "@/assets/images/onboarding3.jpg";
import sign_up_background from "@/assets/images/sign_up_background.jpg";
import sign_in_background from "@/assets/images/sign_in_background.jpg";

export const images = { 
  onboarding1, 
  onboarding2, 
  onboarding3,
  sign_up_background,
  sign_in_background
};

export const onboarding = [
  {
      id: 1,
      title: "Get Accurate Real Time Data",
      description:
          "Get data from your farm immediately.",
      image: images.onboarding1,
  },
  {
      id: 2,
      title: "Know about best practices",
      description:
          "Learn best practices regarding your crops and farming.",
      image: images.onboarding2,
  },
  {
      id: 3,
      title: "Keep an eye",
      description:
          "Get real time alerts about your crops.",
      image: images.onboarding3,
  },
];

export const data = {
  onboarding,
};