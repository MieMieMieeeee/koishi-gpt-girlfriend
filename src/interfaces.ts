declare module 'koishi' {
  interface Tables {
    girlfriends: Girlfriends
    girlfriends_global: GirlfriendsGlobal
  }
}

export interface Girlfriend extends JSON {
  age?: string
  hair_color?: string
  expect_hair_dye_color?: string
  hair_style?: string
  eye_color?: string
  speciality?: string
  career?: string
  personality?: string
  height?: string
  weight?: string
  cloth?: string
  appearance?: string
  face_shape?: string
  body_shape?: string
  hobbies?: string
  background?: string
  tag?: string
  favorability?: number
}

export interface BattleStats extends JSON {
  totalBattles: number
  totalWins: number
}


export interface Girlfriends {
  id: number
  uid: string
  currentGirlfriend?: Girlfriend
  newGirlfriend?: JSON
  battle?: {
    hp: number
    skills?: any[]
  }
  sign?: {
    lastSignDate?: string
  }
  currency?: number
  goods?: JSON
  store?: {
    storeDate?: string
    storeGoods?: JSON
  }
  signature?: string
  battleStats?: BattleStats
  other?: string
}

export interface GirlfriendsGlobal extends JSON {
  id: number
  inBattle: boolean
}
