'use client';

import { SellerFrame } from '@/components/seller/seller-frame';
import { SellerQuestions } from '@/components/seller/seller-questions';

export default function SellerQuestionsPage() {
  return (
    <SellerFrame active="questions" width="max-w-4xl">
      <h1 className="mb-1 text-foreground">Questions from buyers</h1>
      <p className="mb-5 text-base text-muted-foreground">Buyers ask about your birds on the product page. Your answer is public, so every visitor can read it. A quick, clear answer helps you sell.</p>
      <SellerQuestions />
    </SellerFrame>
  );
}
