import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  query!: string;
}

export class VideoCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  videoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  songId?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(80)
  requestId!: string;

  @IsOptional()
  @IsInt()
  expectedRevision?: number;
}

export class NextDto {
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  requestId!: string;

  @IsInt()
  expectedRevision!: number;
}

export class PermissionsDto {
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  requestId!: string;

  @IsInt()
  expectedRevision!: number;

  @IsOptional() @IsBoolean() memberCanAddSong?: boolean;
  @IsOptional() @IsBoolean() memberCanVoteSkip?: boolean;
  @IsOptional() @IsBoolean() memberCanControlPlayback?: boolean;
  @IsOptional() @IsBoolean() coHostCanControlPlayback?: boolean;
  @IsOptional() @IsBoolean() hostOnlyCanClearQueue?: boolean;
  @IsOptional() @IsBoolean() autoSkipOnThreshold?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(50) skipThreshold?: number;
  @IsOptional() @IsInt() @Min(0) @Max(300000) voteCooldownMs?: number;
  @IsOptional() @IsInt() @Min(5000) @Max(300000) voteDurationMs?: number;
}

export class RevisionQueryDto {
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  requestId!: string;

  @Type(() => Number)
  @IsInt()
  expectedRevision!: number;
}
