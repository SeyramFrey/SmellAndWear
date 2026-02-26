export interface MenuItem {
  id?: number;
  label?: any;
  icon?: string;
  isCollapsed?: any;
  link?: string;
  subItems?: any;
  isTitle?: boolean;
  badge?: any;
  parentId?: number;
  isLayout?: boolean;
  animatedIcon?: { // nouvelle propriété pour les icônes animées
    type: 'lordicon' | 'lottie';
    src: string;
    trigger?: string; // hover, click, loop
    colors?: string;
    stroke?: string;
    style?: string;
  };
}