import { IsUUID } from "class-validator";

export class MockPurchaseDto {
  @IsUUID()
  learningPathId!: string;
}
