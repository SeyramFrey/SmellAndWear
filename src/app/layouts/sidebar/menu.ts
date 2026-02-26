import { MenuItem } from './menu.model';

export const MENU: MenuItem[] = [
  {
    id: 1,
    label: 'MENUITEMS.MENU.TEXT',
    isTitle: true
  },
  {
    id: 2,
    label: 'Dashboard',
    isCollapsed: true,
    animatedIcon: {
      stroke: 'bold',
      type: 'lordicon',
      src: 'https://cdn.lordicon.com/wdztjihe.json',
      trigger: 'loop',
      colors: 'primary:#000000,secondary:#ffffff,tertiary:#1b1091,quaternary:#c71f16',
      style: 'width:30px;height:30x'
    },
    subItems: [
      {
        id: 5,
        label: 'Stats Ventes',
        link: '/admin/',
        parentId: 2
      },
      {
        id: 6,
        label: 'Stats géographiques',
        link: '/admin/geo',
        parentId: 2
      },
    ],
  },
  {
    id: 3,
    label: 'Catégories',
    link: '/admin/ecommerce/categories',
    animatedIcon: {
      stroke: 'bold',
      type: 'lordicon',
      src: 'https://cdn.lordicon.com/lzsupfwm.json',
      trigger: 'loop',
      colors: 'primary:#000000,secondary:#c71f16,tertiary:#ffffff',
      style: 'width:30px;height:30x'
    },
  },
  {
    id: 7,
    label: 'Commandes',
    link: '/admin/ecommerce/orders',
    parentId: 12,
    animatedIcon: {
      stroke: 'bold',
      type: 'lordicon',
      src: 'https://cdn.lordicon.com/tpxyzdfc.json',
      trigger: 'loop',
      colors: 'primary:#000000,secondary:#ffffff,tertiary:#c71f16,quaternary:#c71f16,quinary:#ffffff',
      style: 'width:30px;height:30x'
    },
  },
  {
    id: 9,
    label: 'Meilleurs clients',
    link: '/admin/ecommerce/customers',
    animatedIcon: {
      stroke: 'bold',
      type: 'lordicon',
      src: 'https://cdn.lordicon.com/wmqqbxlm.json',
      trigger: 'loop',
      colors: 'primary:#000000,secondary:#c71f16,tertiary:#c71f16,quaternary:#ffffff,quinary:#ffffff',
      style: 'width:30px;height:30x'
    },
  },
  {
    id: 10,
    label: 'Promos',
    link: '/admin/ecommerce/promos',
    animatedIcon: {
      stroke: 'bold',
      type: 'lordicon',
      src: 'https://cdn.lordicon.com/uepnupwh.json',
      trigger: 'loop',
      colors: 'primary:#000000,secondary:#c71f16',
      style: 'width:30px;height:30x'
    },
  },
  {
    id: 12,
    label: 'Médias',
    link: '/admin/medias/',
    animatedIcon: {
      stroke: 'bold',
      type: 'lordicon',
      src: 'https://cdn.lordicon.com/kttbpskb.json',
      trigger: 'loop',
      colors: 'primary:#121331,secondary:#c71f16,tertiary:#ebe6ef,quaternary:#ffffff,quinary:#4bb3fd,senary:#f24c00,septenary:#2ca58d,octonary:#f28ba8,nonary:#92140c',
      style: 'width:30px;height:30x'
    },
  },
  {
    id: 13,
    label: 'Taris livraisons',
    link: '/admin/ecommerce/delivery-prices',
    animatedIcon: {
      stroke: 'bold',
      type: 'lordicon',
      src: 'https://cdn.lordicon.com/adeleafr.json',
      trigger: 'loop',
      colors: 'primary:#000000,secondary:#ffffff,tertiary:#c71f16',
      style: 'width:30px;height:30x'
    },
  },

];
