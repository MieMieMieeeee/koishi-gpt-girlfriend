declare module 'koishi' {
  interface Tables {
    girlfriends: Girlfriends
    girlfriends_global: GirlfriendsGlobal
  }
}

export interface Girlfriend {
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

export interface Girlfriends {
  id: number
  uid: string
  currentGirlfriend?: Girlfriend
  newGirlfriend?: JSON
  battle?: {
    hp: number
    skills?: any[]
  }
  other?: string
}

export interface GirlfriendsGlobal {
  id: number
  inBattle: boolean
}
