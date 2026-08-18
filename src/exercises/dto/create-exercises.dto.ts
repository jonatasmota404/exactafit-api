import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateExercisesDto {
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsString()
    @IsNotEmpty()
    muscleGroup!: string;

    @IsOptional()
    @IsString()
    type?: string;
}