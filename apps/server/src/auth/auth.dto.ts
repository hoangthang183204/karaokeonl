import { HAIR_COLORS, HAIR_STYLES, LOOK_COLORS, OUTFITS, SKIN_COLORS, GENDERS } from "@karaoke/shared";
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(24)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class SaveAvatarDto {
  @IsIn([...GENDERS])
  gender!: string;

  @IsIn([...SKIN_COLORS])
  skinColor!: string;

  @IsIn([...HAIR_COLORS])
  hairColor!: string;

  @IsIn([...LOOK_COLORS])
  outfitColor!: string;

  @IsIn([...HAIR_STYLES])
  avatarModel!: string;

  @IsIn([...OUTFITS])
  outfit!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
