#!/bin/bash

# Email Function Test Script for refund-connect-1m30
# Replace your-test-email@gmail.com with your actual test email

PROJECT_ID="refund-connect-1m30"
TEST_EMAIL="your-test-email@gmail.com"
FUNCTION_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/sendEmail"

echo "🧪 Testing Email Function: $FUNCTION_URL"
echo "📧 Test emails will be sent to: $TEST_EMAIL"
echo ""

# Test 1: New Message
echo "📨 Test 1: New Message Email"
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"type\": \"new-message\",
      \"emailData\": {
        \"recipientEmail\": \"$TEST_EMAIL\",
        \"recipientName\": \"Test User\",
        \"senderName\": \"John Doe\",
        \"messagePreview\": \"Hello! This is a test message from the automated test script.\",
        \"messageUrl\": \"https://refund-connect-1m30.web.app/messages\"
      }
    }
  }"
echo -e "\n✅ Test 1 complete\n"
sleep 2

# Test 2: Booking Confirmation
echo "📅 Test 2: Booking Confirmation Email"
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"type\": \"booking-confirmation\",
      \"emailData\": {
        \"recipientEmail\": \"$TEST_EMAIL\",
        \"clientName\": \"John Doe\",
        \"professionalName\": \"Jane Smith CPA\",
        \"serviceName\": \"Tax Consultation\",
        \"dateTime\": \"March 20, 2025 at 2:00 PM\",
        \"amount\": \"150.00\",
        \"bookingId\": \"BK123456\",
        \"bookingUrl\": \"https://refund-connect-1m30.web.app/bookings/123\"
      }
    }
  }"
echo -e "\n✅ Test 2 complete\n"
sleep 2

# Test 3: Profile View
echo "👁️ Test 3: Profile View Notification"
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"type\": \"profile-view\",
      \"emailData\": {
        \"recipientEmail\": \"$TEST_EMAIL\",
        \"professionalName\": \"Jane Smith\",
        \"viewerName\": \"John Doe\",
        \"viewedAt\": \"March 15, 2025 at 3:30 PM\",
        \"profileUrl\": \"https://refund-connect-1m30.web.app/profile\"
      }
    }
  }"
echo -e "\n✅ Test 3 complete\n"
sleep 2

# Test 4: Weekly Digest
echo "📊 Test 4: Weekly Digest Email"
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"type\": \"weekly-digest\",
      \"emailData\": {
        \"recipientEmail\": \"$TEST_EMAIL\",
        \"userName\": \"Jane Smith\",
        \"weekRange\": \"March 10-16, 2025\",
        \"newMessages\": 5,
        \"profileViews\": 12,
        \"newBookings\": 3,
        \"earnings\": \"450.00\",
        \"dashboardUrl\": \"https://refund-connect-1m30.web.app/dashboard\"
      }
    }
  }"
echo -e "\n✅ Test 4 complete\n"

echo "🎉 All tests complete! Check $TEST_EMAIL for 4 test emails."
echo "📋 Check Firebase logs: firebase functions:log --only sendEmail"
