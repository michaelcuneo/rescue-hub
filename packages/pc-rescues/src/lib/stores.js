import { writable } from 'svelte/store';

export const coords = writable([151.771274, -32.927406]);
export const mapRef = writable();
export const data = writable({
  pending: [{
    id: 'awmdfk3k2rtnmr',
    lat: '151.7306',
    long: '-32.9242',
    type: 'Bird',
    breed: 'Unknown',
    location: 'Broadmeadow',
    disabled: false,
    color: 'd2222d',
    injury: 'Upside down on ground',
  },
  {
    id: 'asdasfq34qwf4',
    lat: '151.6350',
    long: '-33.0852',
    type: 'Bird',
    breed: 'Pelican',
    location: 'Swansea',
    disabled: false,
    color: 'd2222d',
    injury: 'Upside down on ground',
  }],
  assigned: [{
    id: 'g4e5ag4aeg4ea4g',
    lat: '151.6568',
    long: '-32.9482',
    type: 'Snake',
    breed: 'Brown',
    location: 'Cardiff',
    disabled: false,
    color: 'ffbf00',
    injury: 'Ran over by 4x4',
  },
  {
    id: 'fasoiufdna8sfh7',
    lat: '151.6827',
    long: '-32.9925',
    type: 'Possum',
    breed: '-',
    location: 'Windale',
    disabled: false,
    color: 'ffbf00',
    injury: 'Cat attack',
  }],
  completed: [{
    id: 'gae4fgaw34faw4t',
    lat: '151.7364',
    long: '-32.8974',
    type: 'Wombat',
    breed: '-',
    location: 'Mayfield',
    disabled: false,
    color: '238823',
    injury: 'Ran over by 4x4',
  }]
});