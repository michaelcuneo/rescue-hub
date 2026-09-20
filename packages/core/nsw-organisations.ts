export type NswOrganisationDirectoryEntry = {
  id: string;
  officialName: string;
  displayName: string;
  areaDescription: string;
  speciesSpeciality: string;
  boundaryStatus: "GIS_AVAILABLE" | "TEXT_ONLY";
  aliases: string[];
};

export const NSW_DIRECTORY_SOURCE = "https://www.environment.nsw.gov.au/topics/animals-and-plants/native-animals/rehabilitating-native-animals/licensed-wildlife-rehabilitation-providers-in-nsw";
export const NSW_DIRECTORY_SOURCE_UPDATED_AT = "2026-07-01";

export const nswOrganisationDirectory: NswOrganisationDirectoryEntry[] = [
  {
    "id": "australian-seabird-turtle-rescue",
    "officialName": "Australian Seabird and Turtle Rescue",
    "displayName": "Australian Seabird and Turtle Rescue",
    "areaDescription": "Far-north coast",
    "speciesSpeciality": "Seabirds and shorebirds; marine turtles; sea snakes",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "australian-wildlife-foundation",
    "officialName": "Australian Wildlife Foundation",
    "displayName": "Australian Wildlife Foundation",
    "areaDescription": "Bargo",
    "speciesSpeciality": "Koalas",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "bouddi-wildlife-bat-sanctuary",
    "officialName": "Bouddi Wildlife Bat Sanctuary",
    "displayName": "Bouddi Wildlife Bat Sanctuary",
    "areaDescription": "McMasters Beach",
    "speciesSpeciality": "Flying foxes",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "byron-bay-wildlife-hospital",
    "officialName": "Byron Bay Wildlife Hospital",
    "displayName": "Byron Bay Wildlife Hospital",
    "areaDescription": "Far north coast",
    "speciesSpeciality": "All species",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "coffs-coast-wildlife-sanctuary",
    "officialName": "Coffs Coast Wildlife Sanctuary",
    "displayName": "Coffs Coast Wildlife Sanctuary",
    "areaDescription": "Coffs Harbour and surrounds",
    "speciesSpeciality": "Seabirds and shorebirds; marine mammals and reptiles including marine turtles",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "conmurra-wildlife-sanctuary",
    "officialName": "Conmurra Wildlife Sanctuary",
    "displayName": "Conmurra Wildlife Sanctuary",
    "areaDescription": "Bathurst",
    "speciesSpeciality": "Macropods; other mammals",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "fawna",
    "officialName": "For Australian Wildlife Needing Aid (FAWNA)",
    "displayName": "FAWNA",
    "areaDescription": "NSW mid-north coast; MidCoast, Port Macquarie-Hastings and Kempsey LGAs",
    "speciesSpeciality": "All species except marine mammals and koalas",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "For Australian Wildlife Needing Aid"
    ]
  },
  {
    "id": "friends-of-the-koala",
    "officialName": "Friends of the Koala",
    "displayName": "Friends of the Koala",
    "areaDescription": "Northern NSW coast",
    "speciesSpeciality": "Koalas",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "hills-wildlife-sanctuary",
    "officialName": "The Hills Wildlife Sanctuary",
    "displayName": "The Hills Wildlife Sanctuary",
    "areaDescription": "North-western Sydney",
    "speciesSpeciality": "Flying foxes, possums and gliders, macropods, wombats, monotremes, birds and reptiles",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "irukandji-shark-ray-encounters",
    "officialName": "Irukandji Shark & Ray Encounters Pty Ltd",
    "displayName": "Irukandji Shark & Ray Encounters",
    "areaDescription": "Anna Bay",
    "speciesSpeciality": "Marine turtles; sea snakes",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "port-macquarie-koala-hospital",
    "officialName": "Koala Conservation Australia Inc – Port Macquarie Koala Hospital",
    "displayName": "Port Macquarie Koala Hospital",
    "areaDescription": "Northern NSW – coast, tablelands and western plains",
    "speciesSpeciality": "Koalas",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Koala Conservation Australia Inc"
    ]
  },
  {
    "id": "koalas-in-care",
    "officialName": "Koalas In Care",
    "displayName": "Koalas In Care",
    "areaDescription": "Mid-north coast – greater Taree, Great Lakes and Gloucester",
    "speciesSpeciality": "Koalas",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "native-animal-rescue-group",
    "officialName": "Native Animal Rescue Group (NARG)",
    "displayName": "Native Animal Rescue Group",
    "areaDescription": "Braidwood",
    "speciesSpeciality": "All species except marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "NARG"
    ]
  },
  {
    "id": "native-animal-trust-fund",
    "officialName": "Native Animal Trust Fund Inc",
    "displayName": "Hunter Wildlife Rescue",
    "areaDescription": "Newcastle, Cessnock, Maitland and Lake Macquarie LGAs of the Hunter Region",
    "speciesSpeciality": "All species except marine mammals",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Hunter Wildlife Rescue",
      "NATF"
    ]
  },
  {
    "id": "northern-rivers-wildlife-carers",
    "officialName": "Northern Rivers Wildlife Carers Inc",
    "displayName": "Northern Rivers Wildlife Carers",
    "areaDescription": "Far-northern New South Wales excluding the Tweed Valley",
    "speciesSpeciality": "All species except marine mammals, koalas, wombats and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "northern-tablelands-wildlife-carers",
    "officialName": "Northern Tablelands Wildlife Carers",
    "displayName": "Northern Tablelands Wildlife Carers",
    "areaDescription": "Northern New South Wales excluding the coast",
    "speciesSpeciality": "All species except marine mammals",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "orrca",
    "officialName": "Organisation for the Rescue and Research of Cetaceans (ORRCA)",
    "displayName": "ORRCA",
    "areaDescription": "All coastal New South Wales",
    "speciesSpeciality": "Marine mammals",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Organisation for the Rescue and Research of Cetaceans"
    ]
  },
  {
    "id": "port-stephens-koalas",
    "officialName": "Port Stephens Koalas",
    "displayName": "Port Stephens Koalas",
    "areaDescription": "Tomaree and Tilligerry peninsulas, Port Stephens LGA",
    "speciesSpeciality": "All species except marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "sona",
    "officialName": "Saving Our Native Animals (SONA)",
    "displayName": "Saving Our Native Animals",
    "areaDescription": "Southern New South Wales around Batlow and Tumbarumba",
    "speciesSpeciality": "All species except marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "SONA"
    ]
  },
  {
    "id": "sea-life-sydney-aquarium",
    "officialName": "SEA LIFE Sydney Aquarium",
    "displayName": "SEA LIFE Sydney Aquarium",
    "areaDescription": "Sydney",
    "speciesSpeciality": "Marine reptiles",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "sea-world-australia",
    "officialName": "Sea World Australia",
    "displayName": "Sea World Australia",
    "areaDescription": "South-east Queensland",
    "speciesSpeciality": "Marine mammals; marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "snowy-mountains-wildlife-rescue-laoko",
    "officialName": "Snowy Mountains Wildlife Rescue LAOKO",
    "displayName": "Snowy Mountains Wildlife Rescue LAOKO",
    "areaDescription": "Southern New South Wales – Snowy Mountains to Victorian border",
    "speciesSpeciality": "All species except marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Looking After Our Kosciuszko Orphans",
      "LAOKO"
    ]
  },
  {
    "id": "sunraysia-wildlife-carers",
    "officialName": "Sunraysia Wildlife Carers",
    "displayName": "Sunraysia Wildlife Carers",
    "areaDescription": "Gol Gol – south-western New South Wales along the Victorian border",
    "speciesSpeciality": "All species except marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "sydney-metropolitan-wildlife-services",
    "officialName": "Sydney Metropolitan Wildlife Services",
    "displayName": "Sydney Metropolitan Wildlife Services",
    "areaDescription": "Greater Sydney basin",
    "speciesSpeciality": "All species except marine mammals",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Sydney Wildlife"
    ]
  },
  {
    "id": "taronga-western-plains-zoo-wildlife-clinic",
    "officialName": "Taronga Western Plains Zoo Wildlife Clinic",
    "displayName": "Taronga Western Plains Zoo Wildlife Clinic",
    "areaDescription": "Dubbo",
    "speciesSpeciality": "All species",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "taronga-zoo-wildlife-hospital",
    "officialName": "Taronga Zoo Wildlife Hospital",
    "displayName": "Taronga Zoo Wildlife Hospital",
    "areaDescription": "Sydney",
    "speciesSpeciality": "All species",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "tweed-valley-wildlife-carers",
    "officialName": "Tweed Valley Wildlife Carers",
    "displayName": "Tweed Valley Wildlife Carers",
    "areaDescription": "Far northern NSW; Tweed Valley north of Brunswick Heads",
    "speciesSpeciality": "All species except marine mammals and wombats",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "warrumbungle-wildlife-rescue",
    "officialName": "Warrumbungle Wildlife Rescue and Rehabilitation",
    "displayName": "Warrumbungle Wildlife Rescue and Rehabilitation",
    "areaDescription": "Mendooran, Dubbo and Dunedoo",
    "speciesSpeciality": "All mammals except marine mammals; general birds",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "waterfall-springs-conservation-society",
    "officialName": "Waterfall Springs Conservation Society",
    "displayName": "Waterfall Springs Conservation Society",
    "areaDescription": "Central Coast",
    "speciesSpeciality": "Possums and gliders; macropods; wombats; snakes and lizards",
    "boundaryStatus": "TEXT_ONLY",
    "aliases": []
  },
  {
    "id": "wildcare-queanbeyan",
    "officialName": "Wildcare Queanbeyan",
    "displayName": "Wildcare Queanbeyan",
    "areaDescription": "Southern New South Wales excluding coast and inland to Young area",
    "speciesSpeciality": "All species except marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "wildlife-arc",
    "officialName": "Wildlife Animal Rescue and Care Society (Wildlife ARC)",
    "displayName": "Wildlife ARC",
    "areaDescription": "Gosford and Wyong LGAs, Wyee and Wyee Point, and postcode 2259",
    "speciesSpeciality": "All species except koalas, marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Wildlife Animal Rescue and Care Society"
    ]
  },
  {
    "id": "wildlife-carers-network-central-west",
    "officialName": "Wildlife Carers Network Central West Inc",
    "displayName": "Wildlife Carers Network Central West",
    "areaDescription": "Mudgee, Lithgow, Capertee and Valley, Kelso, Coolah, Tambar Springs and western NSW",
    "speciesSpeciality": "All species except marine mammals and marine reptiles",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "wildlife-rescue-south-coast",
    "officialName": "Wildlife Rescue South Coast",
    "displayName": "Wildlife Rescue South Coast",
    "areaDescription": "NSW coast south of Wollongong",
    "speciesSpeciality": "All species except marine mammals",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": []
  },
  {
    "id": "winc",
    "officialName": "WINC (Wildlife in Need of Care)",
    "displayName": "WINC",
    "areaDescription": "Port Stephens, southern Great Lakes and southern Dungog LGAs",
    "speciesSpeciality": "All species except marine mammals",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Wildlife in Need of Care"
    ]
  },
  {
    "id": "wires",
    "officialName": "WIRES (Wildlife Information, Rescue and Education Service)",
    "displayName": "WIRES",
    "areaDescription": "Branches throughout New South Wales",
    "speciesSpeciality": "All species except marine mammals",
    "boundaryStatus": "GIS_AVAILABLE",
    "aliases": [
      "Wildlife Information, Rescue and Education Service"
    ]
  }
];
