export type WalkthroughStepId = 'chat' | 'portal' | 'reconciliation' | 'courier';

export interface WalkthroughStep {
  id: WalkthroughStepId;
  title: string;
  subtitle: string;
  caption: string;
  tag: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  highlight: string;
}

export interface LandingCopyContent {
  hero: {
    title: string;
    titleAccent: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    demoToggleOpen: string;
    demoToggleClose: string;
    badge: string;
  };
  tour: {
    sectionHeading: string;
    sectionDescription: string;
    nextStep: string;
    prevStep: string;
    steps: WalkthroughStep[];
    simulation: {
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      productName: string;
      totalAmount: string;
      advanceAmount: string;
      codAmount: string;
      trxId: string;
      paymentMethod: string;
      courierTag: string;
      verifiedChip: string;
      dispatchedChip: string;
    };
  };
  features: {
    sectionHeading: string;
    sectionDescription: string;
    items: FeatureItem[];
  };
  ctaBanner: {
    heading: string;
    subheading: string;
    button: string;
    guarantee: string;
  };
}
