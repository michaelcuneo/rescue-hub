// Organisations
type Organisations = Organisation[];

type Organisation = {
  id: string,
  name: string,
  financial: boolean,
  status: string,
  users: User[],
  rescues: Rescues[],
  chats: Chat[],
}

// Users
type Users = User[];

type User = {
  id: string,
  name: string,
  email: string,
  organisations?: Organisation[],
  avatar: string,
  chats?: Chat[],
  rescues?: Rescues[],
}

// Chats
type Chats = Chat[];

type Chat = {
  id: string,
  title: string,
  description: string,
  status: string,
  rescueCategory: RescueCategories,
}

// Rescues
type Rescues = Rescue[];

type RescueCategory = {
  id: string,
  name: RescueCategoryEnum,
  description: string,
  status: string,
  rescues: Rescues[],
}

type Rescue = {
  id: string,
  title: string,
  description: string,
  status: string,
  rescueCategory: RescueCategory,
  users: User[],
  organisations: Organisation[],
}

// Rescue Categories
enum RescueCategoryEnum {
  Reptiles,
  Birds,
  Mammals,
  Amphibians,
  Monotremes,
  Macropods,
  Invertebrates,
  Other,
}