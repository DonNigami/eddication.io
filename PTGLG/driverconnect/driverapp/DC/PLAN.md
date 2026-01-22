@# PLAN.md: DC Log Page Analysis (truckstatus.html)

## 1. Overview

The `truckstatus.html` file is a single-page web application designed for truck drivers or logistics staff to interact with a backend system, which is a Google Apps Script connected to Google Sheets. The page is written in Thai and provides three core functionalities presented in a tabbed interface. It is optimized for mobile use and saves user input locally to prevent data loss.

## 2. Core Features

The application is divided into three main tabs:

### Tab 1: บันทึก DC วันนี้ (Record DC Today)
- **Purpose:** To log key timestamps and information related to a truck's visit to a Distribution Center (DC).
- **Process Flow:**
    1. The user enters a 9-digit Booking Number and their Truck Plate number.
    2. They record various timestamps: Arrival at DC, Start/End of loading, Start/End of document submission, and Departure from DC. "Now" buttons are provided for convenience.
    3. The system validates that timestamps are entered in a logical sequence.
    4. The user must attach a photo of the rear of the truck (with the seal/lock visible) before closing the container. The app shows a preview of the image.
    5. Upon submission, the app resizes the image on the client-side to reduce its file size.
    6. It sends all the collected data, including the Base64-encoded image, to a Google Apps Script endpoint (`action: "saveDcLog"`).
    7. A confirmation (success or error) is displayed to the user.

### Tab 2: แจ้งปัญหาขนส่ง (Report Transport Problem)
- **Purpose:** To report any issues encountered during transportation.
- **Process Flow:**
    1. When the user switches to this tab, the app dynamically fetches a list of predefined problem categories from the Google Apps Script backend (`action: "getProblemList"`).
    2. The user enters the Booking Number, Truck Plate, selects a problem category, and writes a detailed description of the issue.
    3. They can optionally attach multiple photos as evidence.
    4. Upon submission, the app resizes all images.
    5. It sends the report details and Base64-encoded images to the Google Apps Script endpoint (`action: "saveProblem"`).
    6. A confirmation message is shown.

### Tab 3: สถานะ Booking (Booking Status)
- **Purpose:** To check the real-time status of a booking.
- **Process Flow:**
    1. The user enters a 9-digit Booking Number and clicks the search button.
    2. The app sends a request to the Google Apps Script endpoint (`action: "getBookingStatus"`) to fetch the booking's status.
    3. The backend returns data, including potentially multiple "waves" associated with the booking. A "wave" is a work unit in the warehouse (e.g., for picking goods).
    4. The app determines an "overall status" based on the most advanced status among all associated waves (e.g., "Picking", "Pick Completed").
    5. It displays the overall status prominently, along with details for each individual wave (Wave Number, Status, Loading Status, Dock, etc.) in separate cards.
    6. If the booking is not found, an appropriate message is displayed.

## 3. Backend Integration

- **Endpoint:** All operations communicate with a single Google Apps Script URL: `https://script.google.com/macros/s/AKfycbxQDbS5JZyzkbYxfdDLz8q2XCvBbRqQ9fE36Mn_dgvdabzzDcl4R5oV0tliQo_rLfv8RA/exec`.
- **Actions:** The application uses an `action` parameter to tell the backend what to do:
    - `saveDcLog`: Submits the DC time log.
    - `saveProblem`: Submits a transportation problem report.
    - `getProblemList`: Fetches the list of problem types for the dropdown.
    - `getBookingStatus`: Retrieves the current status of a booking.

## 4. Key Technical Details

- **Client-Side Image Resizing:** Uses JavaScript and HTML Canvas to shrink images before uploading, saving bandwidth and time.
- **Local Storage:** Form inputs are saved in the browser's `localStorage` to persist data across page reloads.
- **Asynchronous Operations:** Uses `async/await` and `fetch` for all communication with the backend. A timeout is implemented to prevent requests from hanging indefinitely.
- **UI/UX:** Uses SweetAlert2 for user-friendly pop-up notifications and a responsive CSS design for mobile devices.
